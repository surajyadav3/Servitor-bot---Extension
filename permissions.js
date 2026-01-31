document.getElementById('request-btn').addEventListener('click', async () => {
    const status = document.getElementById('status');
    status.innerText = "Requesting...";
    status.className = "status-msg";

    try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Stop the tracks immediately after getting permission
        stream.getTracks().forEach(track => track.stop());

        status.innerText = "✅ Permission granted! You can now close this tab and return to the side panel.";
        status.className = "status-msg success";

        // Optional: Close tab automatically after 3 seconds
        setTimeout(() => {
            // window.close() might be blocked depending on how it was opened, but worth a try
            // Chrome usually allows window.close() if opened via script
        }, 3000);

    } catch (err) {
        console.error("Permission error:", err);
        status.innerText = "❌ Permission denied. Please click the icon in your address bar to reset permissions.";
        status.className = "status-msg error";
    }
});
