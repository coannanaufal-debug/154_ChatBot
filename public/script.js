// ====== Elemen ======
const chatContainer = document.getElementById('chatContainer');
const messagesList = document.getElementById('messagesList');
const welcomeView = document.getElementById('welcomeView');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const toggleSidebar = document.getElementById('toggleSidebar');
const sidebar = document.getElementById('sidebar');
const chatHistory = document.getElementById('chatHistory');

// ====== State ======
let messages = [];          // riwayat percakapan yang dikirim ke server
let isSending = false;
let conversations = loadConversations();
let activeConversationId = null;

// ====== Util: Markdown sederhana ======
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderMarkdown(raw) {
    let text = escapeHtml(raw || '');

    // Code block ```...```
    const codeBlocks = [];
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        codeBlocks.push(code.replace(/\n$/, ''));
        return `\u0000CODE${codeBlocks.length - 1}\u0000`;
    });

    // Heading
    text = text.replace(/^###### (.*)$/gm, '<h3>$1</h3>')
               .replace(/^##### (.*)$/gm, '<h3>$1</h3>')
               .replace(/^#### (.*)$/gm, '<h3>$1</h3>')
               .replace(/^### (.*)$/gm, '<h3>$1</h3>')
               .replace(/^## (.*)$/gm, '<h2>$1</h2>')
               .replace(/^# (.*)$/gm, '<h1>$1</h1>');

    // Blockquote
    text = text.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');

    // Bold & italic
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
               .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
               .replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Inline code
    text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Link
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // List
    text = text.replace(/^\s*[-*] (.*)$/gm, '<li>$1</li>');
    text = text.replace(/^\s*\d+\. (.*)$/gm, '<li>$1</li>');
    text = text.replace(/(?:^|\n)((?:<li>.*<\/li>\n?)+)/g, (_, list) =>
        `<ul>${list.replace(/\n/g, '')}</ul>`);

    // Paragraf: pecah per blok kosong
    text = text
        .split(/\n{2,}/)
        .map(block => {
            const trimmed = block.trim();
            if (!trimmed) return '';
            if (/^(<h1|<h2|<h3|<ul|<ol|<blockquote|\u0000CODE)/.test(trimmed)) return trimmed;
            return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
        })
        .join('');

    // Kembalikan code block (sudah di-escape saat ekstraksi)
    text = text.replace(/\u0000CODE(\d+)\u0000/g, (_, i) =>
        `<pre><code>${codeBlocks[Number(i)] || ''}</code></pre>`);

    return text;
}

// ====== Util: Storage ======
function loadConversations() {
    try {
        return JSON.parse(localStorage.getItem('claude_conversations') || '[]');
    } catch {
        return [];
    }
}

function saveConversations() {
    try {
        localStorage.setItem('claude_conversations', JSON.stringify(conversations));
    } catch {
        /* ignore */
    }
}

// ====== Render sidebar riwayat ======
function renderHistory() {
    chatHistory.querySelectorAll('.history-item').forEach(el => el.remove());

    conversations.slice(0, 30).forEach(conv => {
        const item = document.createElement('div');
        item.className = 'history-item' + (conv.id === activeConversationId ? ' active' : '');
        item.textContent = conv.title || 'Percakapan baru';
        item.title = conv.title || '';
        item.addEventListener('click', () => openConversation(conv.id));
        chatHistory.appendChild(item);
    });
}

// ====== Render pesan ======
function appendMessage(role, content, opts = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? 'A' : 'C';

    const body = document.createElement('div');
    body.className = 'message-body';

    const roleLabel = document.createElement('div');
    roleLabel.className = 'message-role';
    roleLabel.textContent = role === 'user' ? 'Anda' : 'Claude';

    const contentEl = document.createElement('div');
    contentEl.className = 'message-content' + (opts.error ? ' error' : '');

    if (opts.thinking) {
        contentEl.innerHTML = '<div class="thinking"><span></span><span></span><span></span></div>';
    } else if (role === 'user') {
        contentEl.textContent = content;
    } else {
        contentEl.innerHTML = renderMarkdown(content);
    }

    body.appendChild(roleLabel);
    body.appendChild(contentEl);
    wrapper.appendChild(avatar);
    wrapper.appendChild(body);
    messagesList.appendChild(wrapper);

    scrollToBottom();
    return contentEl;
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showChatView() {
    welcomeView.style.display = 'none';
    messagesList.style.display = 'flex';
}

function showWelcomeView() {
    welcomeView.style.display = 'block';
    messagesList.style.display = 'none';
    messagesList.innerHTML = '';
}

// ====== Percakapan ======
function createConversation() {
    const conv = { id: Date.now().toString(), title: '', messages: [] };
    conversations.unshift(conv);
    activeConversationId = conv.id;
    saveConversations();
    renderHistory();
    return conv;
}

function openConversation(id) {
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;

    activeConversationId = id;
    messages = conv.messages.slice();
    renderHistory();

    if (messages.length === 0) {
        showWelcomeView();
    } else {
        messagesList.innerHTML = '';
        showChatView();
        messages.forEach(m => appendMessage(m.role, m.content));
        scrollToBottom();
    }

    if (window.innerWidth <= 768) sidebar.classList.add('collapsed');
}

// ====== Kirim pesan ======
async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || isSending) return;

    const conv = conversations.find(c => c.id === activeConversationId) || createConversation();

    isSending = true;
    showChatView();

    appendMessage('user', text);
    messageInput.value = '';
    autoResize();
    updateSendState();

    messages.push({ role: 'user', content: text });
    conv.messages = messages.slice();

    if (!conv.title) {
        conv.title = text.length > 40 ? text.slice(0, 40) + '…' : text;
        saveConversations();
        renderHistory();
    }

    sendBtn.classList.add('loading');
    const thinkingEl = appendMessage('assistant', '', { thinking: true });

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        const content = data.content || '(Tidak ada jawaban)';
        thinkingEl.classList.remove('error');
        thinkingEl.innerHTML = renderMarkdown(content);

        messages.push({ role: 'assistant', content });
        conv.messages = messages.slice();
        saveConversations();
    } catch (err) {
        thinkingEl.classList.add('error');
        thinkingEl.textContent = 'Gagal menghubungi server: ' + err.message;
    } finally {
        isSending = false;
        sendBtn.classList.remove('loading');
        updateSendState();
        scrollToBottom();
    }
}

// ====== Input ======
function autoResize() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
}

function updateSendState() {
    const hasText = messageInput.value.trim().length > 0;
    sendBtn.disabled = !hasText || isSending;
}

messageInput.addEventListener('input', () => {
    autoResize();
    updateSendState();
});

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener('click', sendMessage);

// ====== Sidebar & tombol baru ======
newChatBtn.addEventListener('click', () => {
    activeConversationId = null;
    messages = [];
    renderHistory();
    messageInput.value = '';
    autoResize();
    updateSendState();
    showWelcomeView();
    messageInput.focus();
    if (window.innerWidth <= 768) sidebar.classList.add('collapsed');
});

toggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

// ====== Suggestion cards ======
document.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', () => {
        messageInput.value = card.dataset.prompt || '';
        autoResize();
        updateSendState();
        messageInput.focus();
    });
});

// ====== Init ======
(function init() {
    renderHistory();
    updateSendState();
    if (window.innerWidth <= 768) sidebar.classList.add('collapsed');
    messageInput.focus();
})();
