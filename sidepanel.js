document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggle-btn');
    const statusText = document.getElementById('status-text');
    const minimizeBtn = document.getElementById('minimize-btn');
    const transcriptDiv = document.getElementById('transcript');
    const body = document.body;
    const btnIcon = document.getElementById('btn-icon');

    let recognition;
    let isListening = false;
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


    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isListening = true;
            body.classList.add('listening');
            toggleBtn.classList.add('active');
            statusText.innerText = "Listening...";
            btnIcon.innerText = '⏹️';
        };

        recognition.onend = () => {
            if (isListening) {
                recognition.start();
            } else {
                body.classList.remove('listening');
                toggleBtn.classList.remove('active');
                statusText.innerText = "Tap to start";
                btnIcon.innerText = '🎙️';
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

            if (interimTranscript) {
                statusText.innerText = interimTranscript;
            }

            if (finalTranscript) {
                let cmd = finalTranscript.trim();

                // Smart Autocorrect ("Learning" logic)
                cmd = smartCorrect(cmd);

                logTranscript(`🎤 ${cmd}`);
                statusText.innerText = "✓ " + cmd;
                processCommand(cmd);
                setTimeout(() => {
                    if (isListening) statusText.innerText = "Listening...";
                }, 2000);
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

    minimizeBtn.addEventListener('click', () => {
        isMinimized = !isMinimized;
        body.classList.toggle('minimized', isMinimized);
        minimizeBtn.innerText = isMinimized ? '➕' : '➖';
    });


    function processCommand(cmd) {
        const command = cmd.toLowerCase();

        // 0. TAB MANAGEMENT (Check FIRST to prevent "open new tab" from triggering search)
        if (command.includes('new tab') || command === 'open new tab' || command === 'open a new tab') {
            logTranscript(`🤖 Opening new tab...`);
            chrome.tabs.create({});
            return;
        }

        if (command.includes('close tab') || command.includes('close current tab') || command.includes('close this tab')) {
            logTranscript(`🤖 Closing current tab...`);
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) chrome.tabs.remove(tabs[0].id);
            });
            return;
        }

        // 0.5 SEARCH WITHIN CURRENT TAB (search here, search this page)
        if (command.includes('search here') || command.includes('search this') || command.includes('type ')) {
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
            return;
        }

        // 1. OPEN COMMANDS (after tab commands)
        if (command.startsWith('open ')) {
            const target = command.replace('open', '').trim();

            // Skip if it's just "open" with nothing useful
            if (!target || target === 'a' || target === 'the') {
                return;
            }

            logTranscript(`🤖 Opening ${target}...`);

            const sites = {
                'youtube': 'https://www.youtube.com',
                'google': 'https://www.google.com',
                'gmail': 'https://mail.google.com',
                'github': 'https://github.com',
                'facebook': 'https://facebook.com',
                'twitter': 'https://twitter.com',
                'chatgpt': 'https://chat.openai.com',
                'netflix': 'https://netflix.com',
                'amazon': 'https://amazon.com',
                'linkedin': 'https://linkedin.com'
            };

            let url = sites[target] || `https://www.google.com/search?q=${encodeURIComponent(target)}`;
            chrome.tabs.create({ url });
            return;
        }

        // 2. PLAY COMMANDS (YouTube Search + Auto-play)
        if (command.includes('play ')) {
            let song = command.split('play')[1].replace('on youtube', '').trim();
            if (song) {
                logTranscript(`🤖 Playing "${song}" on YouTube...`);
                const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(song)}`;
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
            return;
        }

        // 3. ENHANCED SEARCH COMMANDS (Site Specific)
        if (command.includes('search ')) {
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
                return;
            }

            // Default Google search
            const searchQuery = command.replace('search', '').trim();
            logTranscript(`🤖 Searching for "${searchQuery}"...`);
            chrome.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}` });
            return;
        }


        // 4. NAVIGATION (refresh, back, forward)
        if (command.includes('refresh') || command.includes('reload')) {
            logTranscript(`🤖 Refreshing page...`);
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) chrome.tabs.reload(tabs[0].id);
            });
            return;
        }

        if (command.includes('go back')) {
            logTranscript(`🤖 Going back...`);
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) chrome.tabs.goBack(tabs[0].id);
            });
            return;
        }

        if (command.includes('go forward')) {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) chrome.tabs.goForward(tabs[0].id);
            });
            return;
        }

        // 4.5 SCROLL COMMANDS
        if (command.includes('scroll down') || command.includes('page down')) {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "scroll", direction: "down" });
            });
            return;
        }

        if (command.includes('scroll up') || command.includes('page up')) {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "scroll", direction: "up" });
            });
            return;
        }

        if (command.includes('scroll to top') || command.includes('go to top') || command === 'top') {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "scroll", direction: "top" });
            });
            return;
        }

        if (command.includes('scroll to bottom') || command.includes('go to bottom') || command === 'bottom') {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "scroll", direction: "bottom" });
            });
            return;
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

        // 6. UI CONTROL
        if (command.includes('hide interface') || command.includes('hide assistant') || command.includes('minimize')) {
            if (!isMinimized) toggleMinimize();
            return;
        }

        if (command.includes('show interface') || command.includes('show assistant') || command.includes('maximize')) {
            if (isMinimized) toggleMinimize();
            return;
        }
    }
});


