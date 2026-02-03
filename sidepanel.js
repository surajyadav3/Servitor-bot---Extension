document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggle-btn');
    const statusText = document.getElementById('status-text');

    const transcriptDiv = document.getElementById('transcript');
    const body = document.body;
    const btnIcon = document.getElementById('btn-icon');
    const helpBtn = document.getElementById('help-btn');
    const helpOverlay = document.getElementById('help-overlay');
    const closeHelp = document.getElementById('close-help');

    // Help Logic
    helpBtn.addEventListener('click', () => {
        helpOverlay.classList.add('open');
    });

    closeHelp.addEventListener('click', () => {
        helpOverlay.classList.remove('open');
    });

    helpOverlay.addEventListener('click', (e) => {
        if (e.target === helpOverlay) {
            helpOverlay.classList.remove('open');
        }
    });

    let recognition;
    let isListening = false;
    let isSleeping = false; // New state for "wake word" mode
    let isMinimized = false;

    function logTranscript(text) {
        const p = document.createElement('p');
        p.innerText = text;
        transcriptDiv.appendChild(p);
        transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
        if (transcriptDiv.children.length > 20) {
            transcriptDiv.removeChild(transcriptDiv.firstChild);
        }
    }


    const sites = {
        'youtube': 'https://www.youtube.com',
        'google': 'https://www.google.com',
        'gmail': 'https://mail.google.com',
        'github': 'https://github.com',
        'facebook': 'https://facebook.com',
        'twitter': 'https://twitter.com',
        'chatgpt': 'https://chat.openai.com',
        'netflix': 'https://www.netflix.com',
        'amazon': 'https://www.amazon.com',
        'linkedin': 'https://www.linkedin.com',
        'prime': 'https://www.primevideo.com',
        'prime video': 'https://www.primevideo.com',
        'hotstar': 'https://www.hotstar.com',
        'disney plus': 'https://www.hotstar.com',
        'hulu': 'https://www.hulu.com',
        'spotify': 'https://open.spotify.com'
    };

    function extractLatestCommand(input) {
        let text = input.trim();

        // 1. Handle Corrections (Split by "no", "wait", "actually")
        const indicators = [' no ', ' wait ', ' actually ', ' cancel ', ' instead ', ' stop '];
        for (const word of indicators) {
            if (text.includes(word)) {
                const parts = text.split(word);
                text = parts[parts.length - 1].trim();
            }
        }

        // 2. Identify the LATEST command start
        const siteKeys = Object.keys(sites).join('|');

        // Patterns to detect command starts
        const commandPatterns = [
            { regex: new RegExp(`\\bopen\\s+(${siteKeys}|new tab)\\b`, 'i'), type: 'open_safe' },
            { regex: /\b(close\s+tab|close\s+this\s+tab)\b/i, type: 'close_tab' },
            { regex: /\b(scroll|page)\s+(up|down|top|bottom)\b/i, type: 'scroll' },
            { regex: /\b(go\s+back|go\s+forward|refresh|reload)\b/i, type: 'nav' },
            { regex: /\bplay\s+/i, type: 'play' },
            { regex: /\bsearch\s+/i, type: 'search' },
            { regex: /\btype\s+/i, type: 'type' }
        ];

        let bestIndex = -1;

        commandPatterns.forEach(p => {
            const globalRegex = new RegExp(p.regex, 'gi');
            let match;
            while ((match = globalRegex.exec(text)) !== null) {
                if (match.index > bestIndex) {
                    bestIndex = match.index;
                }
            }
        });

        if (bestIndex > 0) {
            return text.substring(bestIndex).trim();
        }

        return text;
    }

    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isListening = true;
            if (!isSleeping) {
                body.classList.add('listening');
                toggleBtn.classList.add('active');
                statusText.innerText = "Listening...";
                btnIcon.src = 'icons/stop.svg';
            } else {
                statusText.innerText = "Sleeping...";
                btnIcon.src = 'icons/mic.svg'; // Keep mic when sleeping
                body.classList.add('sleeping');
            }
        };

        recognition.onend = () => {
            if (isListening) {
                recognition.start();
            } else {
                body.classList.remove('listening');
                body.classList.remove('sleeping');
                toggleBtn.classList.remove('active');
                statusText.innerText = "Tap to start";
                btnIcon.src = 'icons/mic.svg';
            }
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            // Live Transcript Handling
            let liveP = document.getElementById('live-transcript');
            if (interimTranscript) {
                if (!liveP) {
                    liveP = document.createElement('p');
                    liveP.id = 'live-transcript';
                    liveP.style.opacity = '0.7';
                    transcriptDiv.appendChild(liveP);
                }
                liveP.innerText = `... ${interimTranscript}`;
                transcriptDiv.scrollTop = transcriptDiv.scrollHeight;

                // TURBO MODE: Instant execution
                const lowerInterim = interimTranscript.toLowerCase().trim();

                // sleep mode check (only wake up)
                if (isSleeping) {
                    if (lowerInterim.includes('wake up') || lowerInterim.includes('start listening') || lowerInterim.includes('wake up bot')) {
                        // Wake up immediately on interim? Maybe safer to wait for final to avoid accidents, 
                        // but for "wake up" speed is nice. Let's wait for final to be robust.
                    }
                    return; // Ignore other turbo commands while sleeping
                }

                if (lowerInterim.includes('scroll') || lowerInterim.includes('page') || lowerInterim.includes('go back') || lowerInterim.includes('refresh')) {
                    if (!window.lastTurbo || (Date.now() - window.lastTurbo > 800)) {
                        let quickCmd = smartCorrect(lowerInterim);
                        quickCmd = extractLatestCommand(quickCmd);

                        if (processCommand(quickCmd, true)) {
                            window.lastTurbo = Date.now();
                            const orb = document.querySelector('.orb');
                            if (orb) {
                                orb.style.background = 'radial-gradient(circle at 30% 30%, #fff, var(--primary-color))';
                                setTimeout(() => { orb.style.background = ''; }, 200);
                            }
                        }
                    }
                }
            }

            if (finalTranscript) {
                // Remove live placeholder
                if (liveP) liveP.remove();

                let cmd = finalTranscript.trim();
                cmd = smartCorrect(cmd);

                // Check for Wake/Sleep commands specially
                if (isSleeping) {
                    if (cmd.includes('wake up') || cmd.includes('start listening') || cmd.includes('hey bot')) {
                        isSleeping = false;
                        body.classList.add('listening');
                        toggleBtn.classList.add('active');
                        statusText.innerText = "Listening...";
                        btnIcon.src = 'icons/stop.svg';
                        logTranscript("⚡ I'm awake!");
                        return;
                    }
                    // Stay sleeping, ignore everything else
                    return;
                }

                if (cmd.includes('stop listening') || cmd.includes('go to sleep') || cmd.includes('pause listening')) {
                    isSleeping = true;
                    body.classList.remove('listening');
                    toggleBtn.classList.remove('active'); // Visually look inactive
                    statusText.innerText = "Sleeping (Say 'Wake up')";
                    btnIcon.src = 'icons/mic.svg'; // Use mic icon for sleep state
                    logTranscript("💤 Going to sleep...");
                    return;
                }

                // Intelligently extract latest command
                const originalCmd = cmd;
                cmd = extractLatestCommand(cmd);

                if (cmd !== originalCmd) {
                    logTranscript(`🎤 Heard: "${originalCmd}"`);
                    logTranscript(`⚡ Executing: "${cmd}"`);
                } else {
                    logTranscript(`🎤 ${cmd}`);
                }

                processCommand(cmd);

                // Keep status text simple
                if (isListening && !isSleeping) statusText.innerText = "Listening...";
            }
        };

        function smartCorrect(text) {
            let corrected = text.toLowerCase();
            const corrections = {
                // Commands
                'open': ['opan', 'hopin', 'oping', 'hope in', 'hopen'],
                'close': ['clothes', 'closed', 'clause', 'lose'],
                'search': ['switch', 'surch', 'seek', 'find', 'sirch'],
                'scroll': ['stroll', 'scrol', 'role', 'school'],
                'play': ['plate', 'lay', 'playing', 'pay'],
                'type': ['write', 'tight', 'tie'],

                // Targets
                'youtube': ['u tube', 'you tube', 'utube', 'your tube'],
                'google': ['googl', 'gogle', 'gogal'],
                'github': ['git hub', 'get hub', 'github'],
                'netflix': ['net flicks', 'netflex'],
                'tab': ['tub', 'tap', 'top', 'cab']
            };

            for (const [correct, wrongs] of Object.entries(corrections)) {
                for (const wrong of wrongs) {
                    // Match whole words or phrases
                    if (corrected.includes(wrong)) {
                        const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
                        corrected = corrected.replace(regex, correct);
                    }
                }
            }
            return corrected;
        }

        recognition.onerror = (event) => {
            if (event.error === 'not-allowed') {
                statusText.innerHTML = '<span style="color:#ef4444">Mic blocked</span>';
            } else if (event.error !== 'no-speech') {
                statusText.innerText = event.error;
            }
        };
    } else {
        statusText.innerText = "Not supported";
        toggleBtn.disabled = true;
    }

    toggleBtn.addEventListener('click', () => {
        if (isListening) {
            isListening = false;
            recognition.stop();
        } else {
            isListening = true;
            statusText.innerText = "Starting...";
            try {
                recognition.start();
            } catch (err) {
                statusText.innerText = "Error";
            }
        }
    });

    function toggleMinimize() {
        isMinimized = !isMinimized;
        body.classList.toggle('minimized', isMinimized);
    }


    function processCommand(cmd, isTurbo = false) {
        const command = cmd.toLowerCase();

        // 0. TAB MANAGEMENT (Check FIRST to prevent "open new tab" from triggering search)
        if (command.includes('new tab') || command === 'open new tab' || command === 'open a new tab') {
            logTranscript(`🤖 Opening new tab...`);
            chrome.tabs.create({});
            return true;
        }

        if (command.includes('close tab') || command.includes('close current tab') || command.includes('close this tab')) {
            // Turbo safety: don't close tabs on interim result unless very sure (skip for now)
            if (isTurbo) return false;
            logTranscript(`🤖 Closing current tab...`);
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) chrome.tabs.remove(tabs[0].id);
            });
            return true;
        }

        // 0.5 SEARCH WITHIN CURRENT TAB (search here, search this page)
        if (command.includes('search here') || command.includes('search this') || command.includes('type ')) {
            if (isTurbo) return false; // Don't type partially
            let query = command
                .replace('search here for', '')
                .replace('search here', '')
                .replace('search this page for', '')
                .replace('search this for', '')
                .replace('type', '')
                .replace('for', '')
                .trim();

            if (query) {
                logTranscript(`🤖 Searching in current tab for "${query}"...`);
                chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                    if (tabs[0]) {
                        chrome.tabs.sendMessage(tabs[0].id, { action: "search_in_page", query: query })
                            .then(response => {
                                if (response && response.success) {
                                    logTranscript(`🤖 Searched on ${response.site}!`);
                                }
                            })
                            .catch(err => {
                                logTranscript(`🤖 Couldn't search here. Try saying "search [query] on youtube" instead.`);
                                console.log("Content script error:", err);
                            });
                    }
                });
            }
            return true;
        }


        // 1. OPEN COMMANDS (after tab commands)
        if (command.startsWith('open ')) {
            if (isTurbo) return false; // Open can wait

            const target = command.replace('open', '').trim();

            // Skip if it's just "open" with nothing useful
            if (!target || target === 'a' || target === 'the') {
                return;
            }

            logTranscript(`🤖 Opening ${target}...`);

            let url = sites[target] || `https://www.google.com/search?q=${encodeURIComponent(target)}`;
            chrome.tabs.create({ url });
            return true;
        }

        // 2. PLAY COMMANDS (YouTube Search + Auto-play)
        if (command.includes('play ')) {
            if (isTurbo) return false;
            let song = command.split('play')[1].replace('on youtube', '').trim();
            if (song) {
                logTranscript(`🤖 Playing "${song}" on YouTube...`);
                const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(song)}`;

                // Stop listening so the video audio doesn't interfere
                if (isListening) {
                    isListening = false;
                    recognition.stop();
                    logTranscript("🤖 Stopped listening for playback.");
                }

                chrome.tabs.create({ url: searchUrl }, (tab) => {
                    const listener = (tabId, changeInfo) => {
                        if (tabId === tab.id && changeInfo.status === 'complete') {
                            chrome.tabs.onUpdated.removeListener(listener);
                            chrome.tabs.sendMessage(tabId, { action: "play_first_video" })
                                .catch(err => console.log("Content script not active yet"));
                        }
                    };
                    chrome.tabs.onUpdated.addListener(listener);
                });
            }
            return true;
        }

        // 3. ENHANCED SEARCH COMMANDS (Site Specific)
        if (command.includes('search ')) {
            if (isTurbo) return false;
            let site = '';
            let query = '';

            if (command.includes(' on amazon')) {
                site = 'amazon';
                query = command.replace('search ', '').replace(' on amazon', '').trim();
            } else if (command.includes(' on wikipedia')) {
                site = 'wikipedia';
                query = command.replace('search ', '').replace(' on wikipedia', '').trim();
            } else if (command.includes(' on ebay')) {
                site = 'ebay';
                query = command.replace('search ', '').replace(' on ebay', '').trim();
            } else if (command.includes(' on flipkart')) {
                site = 'flipkart';
                query = command.replace('search ', '').replace(' on flipkart', '').trim();
            }

            if (site && query) {
                logTranscript(`🤖 Searching ${site} for "${query}"...`);
                const urls = {
                    amazon: `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
                    wikipedia: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`,
                    ebay: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`,
                    flipkart: `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`
                };
                chrome.tabs.create({ url: urls[site] });
                return true;
            }

            // Default Google search
            const searchQuery = command.replace('search', '').trim();
            logTranscript(`🤖 Searching for "${searchQuery}"...`);
            chrome.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}` });
            return true;
        }



        // 4. NAVIGATION (refresh, back, forward)
        if (command.includes('refresh') || command.includes('reload')) {
            logTranscript(`🤖 Refreshing page...`);
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) chrome.tabs.reload(tabs[0].id);
            });
            return true;
        }

        if (command.includes('go back')) {
            if (!isTurbo) logTranscript(`🤖 Going back...`); // Don't spam log in turbo
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) chrome.tabs.goBack(tabs[0].id);
            });
            return true;
        }

        if (command.includes('go forward')) {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) chrome.tabs.goForward(tabs[0].id);
            });
            return true;
        }

        // 4.5 SCROLL COMMANDS
        if (command.includes('scroll down') || command.includes('page down')) {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "scroll", direction: "down" });
            });
            return true;
        }

        if (command.includes('scroll up') || command.includes('page up')) {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "scroll", direction: "up" });
            });
            return true;
        }

        if (command.includes('scroll to top') || command.includes('go to top') || command === 'top') {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "scroll", direction: "top" });
            });
            return true;
        }

        if (command.includes('scroll to bottom') || command.includes('go to bottom') || command === 'bottom') {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "scroll", direction: "bottom" });
            });
            return true;
        }

        // 5. SITE SPECIFIC SEARCH (Direct)
        if (command.includes('on youtube')) {
            const query = command.replace('search', '').replace('on youtube', '').replace('for', '').trim();
            if (query) {
                logTranscript(`🤖 Searching YouTube for "${query}"...`);
                chrome.tabs.create({ url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` });
            }
            return;
        }

        if (command.includes('on google')) {
            const query = command.replace('search', '').replace('on google', '').replace('for', '').replace('open', '').trim();
            if (query) {
                logTranscript(`🤖 Searching Google for "${query}"...`);
                chrome.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
            }
            return;
        }


    }
    // 3D Tilt Effect
    const container = document.querySelector('.container');
    document.addEventListener('mousemove', (e) => {
        if (isMinimized) return; // Don't tilt if minimized

        let x = (window.innerWidth / 2 - e.clientX) / 20;
        let y = (window.innerHeight / 2 - e.clientY) / 20;

        container.style.transform = `rotateY(${x}deg) rotateX(${y}deg)`;
    });

    document.addEventListener('mouseleave', () => {
        container.style.transform = `rotateY(0deg) rotateX(0deg)`;
        container.style.transition = 'transform 0.5s ease';
    });

    document.addEventListener('mouseenter', () => {
        container.style.transition = 'none';
    });

});


