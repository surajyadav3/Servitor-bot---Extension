// Content script for Voice Commander
// Runs on YouTube and Google pages

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Voice Commander content script received:", request);

    // Play first video in YouTube search results
    if (request.action === "play_first_video") {
        console.log("Voice Commander: Attempting to play first video...");
        const firstVideo = document.querySelector('ytd-video-renderer a#thumbnail');
        if (firstVideo) {
            console.log("Voice Commander: Found video, clicking...");
            firstVideo.click();
        } else {
            console.log("Voice Commander: No video found.");
        }
    }

    // Search within the current page (YouTube or Google)
    if (request.action === "search_in_page") {
        const query = request.query;
        console.log("Voice Commander: Searching in page for:", query);

        const url = window.location.href;

        // YouTube search
        if (url.includes("youtube.com")) {
            const searchInput = document.querySelector('input#search, input[name="search_query"]');
            if (searchInput) {
                searchInput.value = query;
                searchInput.focus();

                // Trigger the search
                const searchForm = document.querySelector('form#search-form');
                if (searchForm) {
                    searchForm.submit();
                } else {
                    // Fallback: simulate Enter key
                    const event = new KeyboardEvent('keydown', {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true
                    });
                    searchInput.dispatchEvent(event);

                    // Another fallback: click search button
                    const searchBtn = document.querySelector('button#search-icon-legacy');
                    if (searchBtn) searchBtn.click();
                }
                sendResponse({ success: true, site: "youtube" });
            } else {
                // Navigate to search results directly
                window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                sendResponse({ success: true, site: "youtube", method: "redirect" });
            }
        }

        // Google search
        else if (url.includes("google.com")) {
            const searchInput = document.querySelector('input[name="q"], textarea[name="q"]');
            if (searchInput) {
                searchInput.value = query;
                searchInput.focus();

                const searchForm = searchInput.closest('form');
                if (searchForm) {
                    searchForm.submit();
                }
                sendResponse({ success: true, site: "google" });
            } else {
                window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                sendResponse({ success: true, site: "google", method: "redirect" });
            }
        }

        else {
            sendResponse({ success: false, reason: "Not on a supported search page" });
        }
    }

    // Scroll the page
    if (request.action === "scroll") {
        const direction = request.direction;
        const amount = request.amount || 400;

        if (direction === "up") {
            window.scrollBy({ top: -amount, behavior: 'smooth' });
        } else if (direction === "down") {
            window.scrollBy({ top: amount, behavior: 'smooth' });
        } else if (direction === "top") {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (direction === "bottom") {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
        sendResponse({ success: true });
    }

    return true; // Keep the message channel open for async response
});

console.log("Voice Commander content script loaded on:", window.location.href);
