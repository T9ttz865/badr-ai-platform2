// ===============================
// MARKDOWN RENDER
// ===============================

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
    } catch {
        return `<p>${text}</p>`;
    }
}


// ===============================
// COPY CODE
// ===============================

function copyCode(id) {
    const el = document.getElementById(id);
    if (!el) return;
    navigator.clipboard.writeText(el.innerText);
}


// ===============================
// MODE DETECTION
// ===============================

function detectMode() {
    const path = window.location.pathname;
    if (path.includes("pdf")) return "pdf";
    if (path.includes("text")) return "text";
    return "chat";
}


// ===============================
// SEND MESSAGE
// ===============================

async function sendMessage(mode = null) {

    const input = document.getElementById("userInput");
    const wrapper = document.querySelector(".chat-wrapper");

    if (!input || !wrapper) return;

    const message = input.value.trim();
    if (!message) return;

    if (!mode) mode = detectMode();

    // USER MESSAGE
    const userRow = document.createElement("div");
    userRow.className = "message-row user user-message";

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
    userRow.appendChild(userContent);

    wrapper.appendChild(userRow);

    input.value = "";
    scrollToBottom();

    // LOADING
    const loadingRow = document.createElement("div");
    loadingRow.className = "message-row ai ai-message";

    loadingRow.innerHTML = `
    <div class="avatar">AI</div>
    <div class="message-content">
        <div class="sender-name">Badr AI</div>
        <div class="bubble">⏳ Processing...</div>
    </div>
    `;

    wrapper.appendChild(loadingRow);
    scrollToBottom();

    try {

        const response = await fetch("/chat_stream", {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=UTF-8" },
            body: JSON.stringify({ message, mode })
        });

        loadingRow.remove();

        const aiRow = document.createElement("div");
        aiRow.className = "message-row ai ai-message";

        const bubble = document.createElement("div");
        bubble.className = "bubble ai-bubble";

        aiRow.innerHTML = `
        <div class="avatar">AI</div>
        <div class="message-content">
            <div class="sender-name">Badr AI</div>
        </div>
        `;

        aiRow.querySelector(".message-content").appendChild(bubble);
        wrapper.appendChild(aiRow);

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

                if (!part.startsWith("data:")) continue;

                const jsonStr = part.replace("data:", "").trim();
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

        errorRow.innerHTML = `
        <div class="avatar">AI</div>
        <div class="message-content">
            <div class="sender-name">Badr AI</div>
            <div class="bubble">⚠ Connection error — check Flask server</div>
        </div>
        `;

        wrapper.appendChild(errorRow);
        scrollToBottom();
        console.error(error);
    }
}


// ===============================
// SCROLL
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
// DOM READY
// ===============================

document.addEventListener("DOMContentLoaded", function() {

    // ENTER SEND
    const input = document.getElementById("userInput");
    if (input) {
        input.addEventListener("keydown", function(e) {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(detectMode());
            }
        });
    }

    // ===============================
    // 🔥 SIDEBAR TOGGLE (FIX)
    // ===============================

    const menuBtn = document.querySelector('.menu-btn');
    const sidebar = document.querySelector('.sidebar');

    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // ===============================
    // CV ANALYSIS
    // ===============================

    const analysisBtn = document.getElementById("analysisButton");

    if (analysisBtn) {

        analysisBtn.replaceWith(analysisBtn.cloneNode(true));
        const newBtn = document.getElementById("analysisButton");

        newBtn.addEventListener("click", async function() {

            const fileInput = document.getElementById("cvFileInput");
            const jobTitleInput = document.getElementById("jobTitle");
            const resultsContent = document.getElementById("resultsContent");
            const selectedCard = document.querySelector(".tool-card.selected");

            if (!selectedCard) return;

            const selectedTool = selectedCard.dataset.tool;
            const file = fileInput.files[0];
            const jobTitle = jobTitleInput.value;

            if (!file) return;

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

            } catch {

                if (resultsContent) {
                    resultsContent.innerHTML = `
                    <div class="result-item">
                        <h3>Error</h3>
                        <p>AI analysis failed.</p>
                    </div>`;
                }
            }

            newBtn.classList.remove("loading");
            newBtn.disabled = false;

            const resultsSection = document.getElementById("resultsSection");
            if (resultsSection) {
                resultsSection.scrollIntoView({ behavior: "smooth" });
            }

        });
    }

});