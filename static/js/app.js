const mdRenderer = new marked.Renderer();

mdRenderer.code = function(code, language) {

    const lang = (language || "plaintext").toLowerCase();

    let highlighted;

    try {
        highlighted = hljs.getLanguage(lang) ?
            hljs.highlight(code, { language: lang }).value :
            hljs.highlightAuto(code).value;
    } catch (e) {
        highlighted = code;
    }

    const id = "cb-" + Math.random().toString(36).substr(2, 7);

    return `
<div class="code-block">
  <div class="code-header">
    <span class="code-lang">${lang}</span>
    <button class="copy-btn" onclick="copyCode('${id}')">
      نسخ
    </button>
  </div>
  <pre><code id="${id}" class="hljs language-${lang}">${highlighted}</code></pre>
</div>`;
};

mdRenderer.table = function(header, body) {
    return `<div class="table-wrapper"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
};

mdRenderer.blockquote = function(quote) {
    return `<blockquote>${quote}</blockquote>`;
};

marked.setOptions({
    breaks: true,
    gfm: true,
    renderer: mdRenderer
});

function renderMarkdown(text) {

    if (!text) return "";

    try {
        return marked.parse(text);
    } catch (e) {
        return `<p>${text}</p>`;
    }

}


// ===============================
// Copy Code
// ===============================

function copyCode(id) {

    const el = document.getElementById(id);
    if (!el) return;

    navigator.clipboard.writeText(el.innerText);

}


// ===============================
// Detect Page Mode
// ===============================

function detectMode() {

    const path = window.location.pathname;

    if (path.includes("pdf")) return "pdf";
    if (path.includes("text")) return "text";

    return "chat";

}


// ===============================
// Send Message
// ===============================

async function sendMessage(mode = null) {

    const input = document.getElementById("userInput");
    const wrapper = document.querySelector(".chat-wrapper");

    if (!input || !wrapper) return;

    const message = input.value.trim();
    if (!message) return;

    if (!mode) mode = detectMode();

    // ===============================
    // USER MESSAGE
    // ===============================

    const userRow = document.createElement("div");
    userRow.className = "message-row user user-message";

    const userAvatar = document.createElement("div");
    userAvatar.className = "avatar";
    userAvatar.style.display = "none";

    const userContent = document.createElement("div");
    userContent.className = "message-content";

    const userName = document.createElement("div");
    userName.className = "sender-name";
    userName.textContent = "أنت";

    const userBubble = document.createElement("div");
    userBubble.className = "bubble";
    userBubble.textContent = message;

    userContent.appendChild(userName);
    userContent.appendChild(userBubble);

    userRow.appendChild(userAvatar);
    userRow.appendChild(userContent);

    wrapper.appendChild(userRow);

    input.value = "";
    scrollToBottom();


    // ===============================
    // LOADING
    // ===============================

    const loadingRow = document.createElement("div");
    loadingRow.className = "message-row ai ai-message";

    const loadingAvatar = document.createElement("div");
    loadingAvatar.className = "avatar";
    loadingAvatar.textContent = "AI";

    const loadingContent = document.createElement("div");
    loadingContent.className = "message-content";

    const loadingName = document.createElement("div");
    loadingName.className = "sender-name";
    loadingName.textContent = "Badr AI";

    const loadingBubble = document.createElement("div");
    loadingBubble.className = "bubble";
    loadingBubble.textContent = "⏳ Processing...";

    loadingContent.appendChild(loadingName);
    loadingContent.appendChild(loadingBubble);

    loadingRow.appendChild(loadingAvatar);
    loadingRow.appendChild(loadingContent);

    wrapper.appendChild(loadingRow);

    scrollToBottom();


    try {

        const response = await fetch("/chat_stream", {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=UTF-8"
            },
            body: JSON.stringify({
                message: message,
                mode: mode
            })
        });

        loadingRow.remove();

        const aiRow = document.createElement("div");
        aiRow.className = "message-row ai ai-message";

        const aiAvatar = document.createElement("div");
        aiAvatar.className = "avatar";
        aiAvatar.textContent = "AI";

        const aiContent = document.createElement("div");
        aiContent.className = "message-content";

        const aiName = document.createElement("div");
        aiName.className = "sender-name";
        aiName.textContent = "Badr AI";

        const bubble = document.createElement("div");
        bubble.className = "bubble ai-bubble";

        aiContent.appendChild(aiName);
        aiContent.appendChild(bubble);

        aiRow.appendChild(aiAvatar);
        aiRow.appendChild(aiContent);

        wrapper.appendChild(aiRow);

        scrollToBottom();

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        let buffer = "";
        let fullText = "";

        while (true) {

            const { value, done } = await reader.read();

            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const parts = buffer.split("\n\n");
            buffer = parts.pop();

            for (const part of parts) {

                const line = part.trim();

                if (!line.startsWith("data:")) continue;

                const jsonStr = line.replace("data:", "").trim();

                if (!jsonStr) continue;

                try {

                    const data = JSON.parse(jsonStr);

                    if (data.token) {

                        fullText += data.token;

                        bubble.innerHTML = renderMarkdown(fullText);

                        scrollToBottom();
                    }

                } catch (e) {
                    console.warn("stream parse error", e);
                }

            }

        }

    } catch (error) {

        loadingRow.remove();

        const errorRow = document.createElement("div");
        errorRow.className = "message-row ai ai-message";

        const avatar = document.createElement("div");
        avatar.className = "avatar";
        avatar.textContent = "AI";

        const content = document.createElement("div");
        content.className = "message-content";

        const name = document.createElement("div");
        name.className = "sender-name";
        name.textContent = "Badr AI";

        const bubble = document.createElement("div");
        bubble.className = "bubble";
        bubble.textContent = "⚠ Connection error — check Flask server";

        content.appendChild(name);
        content.appendChild(bubble);

        errorRow.appendChild(avatar);
        errorRow.appendChild(content);

        wrapper.appendChild(errorRow);

        scrollToBottom();

        console.error(error);

    }

}


// ===============================
// Scroll
// ===============================

function scrollToBottom() {

    const chatBox =
        document.getElementById("chatBox") ||
        document.getElementById("chat-container");

    if (!chatBox) return;

    chatBox.scrollTo({
        top: chatBox.scrollHeight,
        behavior: "smooth"
    });

}


// ===============================
// ENTER SEND
// ===============================

document.addEventListener("DOMContentLoaded", function() {

    const input = document.getElementById("userInput");

    if (!input) return;

    input.addEventListener("keydown", function(e) {

        if (e.key === "Enter" && !e.shiftKey) {

            e.preventDefault();

            sendMessage(detectMode());

        }

    });

});
// ===============================
// FIX CV ANALYSIS (ADDED ONLY)
// ===============================

document.addEventListener("DOMContentLoaded", function() {

    const analysisBtn = document.getElementById("analysisButton");

    if (!analysisBtn) return;

    // نمنع التكرار
    analysisBtn.replaceWith(analysisBtn.cloneNode(true));

    const newBtn = document.getElementById("analysisButton");

    newBtn.addEventListener("click", async function() {

        console.log("analysis started");

        const fileInput = document.getElementById("cvFileInput");
        const jobTitleInput = document.getElementById("jobTitle");
        const resultsContent = document.getElementById("resultsContent");

        const selectedCard = document.querySelector(".tool-card.selected");

        if (!selectedCard) {
            console.warn("No tool selected");
            return;
        }

        const selectedTool = selectedCard.dataset.tool;
        const file = fileInput.files[0];
        const jobTitle = jobTitleInput.value;

        if (!file) {
            console.warn("No file uploaded");
            return;
        }

        const formData = new FormData();
        formData.append("cv", file);
        formData.append("job_title", jobTitle);
        formData.append("tool", selectedTool);

        newBtn.classList.add("loading");
        newBtn.disabled = true;

        try {

            const response = await fetch("/analyze_cv", {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            if (resultsContent) {
                resultsContent.classList.add("active");
                resultsContent.innerHTML = data.result;
            }

        } catch (error) {

            console.error(error);

            if (resultsContent) {
                resultsContent.innerHTML = `
                <div class="result-item">
                    <h3>Error</h3>
                    <p>AI analysis failed.</p>
                </div>
                `;
            }

        }

        newBtn.classList.remove("loading");
        newBtn.disabled = false;

        const resultsSection = document.getElementById("resultsSection");
        if (resultsSection) {
            resultsSection.scrollIntoView({ behavior: "smooth" });
        }

    });

});