requireAuth();
requireRole('admin');
renderNav('ai-chat');

const resultBox = document.getElementById('resultBox');
const chatWindow = document.getElementById('chatWindow');
let chatEmpty = document.getElementById('chatEmpty');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const routingSwitch = document.getElementById('routingSwitch');
const routingButtons = routingSwitch.querySelectorAll('.routing-switch-btn');
const newChatBtn = document.getElementById('newChatBtn');
const conversationList = document.getElementById('conversationList');

let sending = false;
let currentConversationId = null;

function setActiveRoutingButton(mode) {
  routingButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === mode));
}

async function loadRoutingStatus() {
  try {
    const res = await api('/ai-settings');
    setActiveRoutingButton(res.data.routing_mode || 'auto');
    const ollamaReady = !!(res.data.ollama_enabled && res.data.ollama_base_url && res.data.ollama_model);
    routingSwitch.querySelector('[data-mode="openrouter"]').disabled = !res.data.has_api_key;
    routingSwitch.querySelector('[data-mode="ollama"]').disabled = !ollamaReady;
  } catch (err) {
    /* kalau gagal memuat, biarkan tombol tetap aktif -- jangan blokir chat gara-gara ini */
  }
}

routingButtons.forEach((btn) => {
  btn.addEventListener('click', async () => {
    if (btn.disabled || btn.classList.contains('active')) return;
    const mode = btn.dataset.mode;
    routingButtons.forEach((b) => { b.disabled = true; });
    try {
      const res = await api('/ai-settings', { method: 'PUT', body: JSON.stringify({ routing_mode: mode }) });
      setActiveRoutingButton(res.data.routing_mode);
      showMessage(`Sumber model diubah ke "${btn.textContent}".`, false);
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      await loadRoutingStatus();
    }
  });
});

function showMessage(message, isError) {
  resultBox.style.display = 'block';
  resultBox.textContent = message;
  resultBox.classList.toggle('error-box', !!isError);
}

function appendBubble(role, text, isError, note) {
  chatEmpty.style.display = 'none';
  const wrap = document.createElement('div');
  wrap.className = `chat-message role-${role}${isError ? ' is-error' : ''}`;
  const col = document.createElement('div');
  col.className = 'chat-message-col';
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = text;
  col.appendChild(bubble);
  if (note) {
    const noteEl = document.createElement('div');
    noteEl.className = 'chat-note';
    noteEl.textContent = note;
    col.appendChild(noteEl);
  }
  wrap.appendChild(col);
  chatWindow.appendChild(wrap);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return bubble;
}

function appendTyping() {
  chatEmpty.style.display = 'none';
  const wrap = document.createElement('div');
  wrap.className = 'chat-message role-assistant';
  wrap.id = 'typingIndicator';
  wrap.innerHTML = '<div class="chat-bubble"><div class="chat-typing"><span></span><span></span><span></span></div></div>';
  chatWindow.appendChild(wrap);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

function resetChatWindow() {
  chatWindow.innerHTML = '';
  chatEmpty = document.createElement('div');
  chatEmpty.className = 'chat-empty';
  chatEmpty.id = 'chatEmpty';
  chatEmpty.textContent = 'Mulai percakapan dengan mengetik pertanyaan di bawah, atau pilih salah satu saran di atas.';
  chatWindow.appendChild(chatEmpty);
}

function startNewConversation() {
  currentConversationId = null;
  resetChatWindow();
  highlightActiveConversation();
  chatInput.focus();
}

function highlightActiveConversation() {
  conversationList.querySelectorAll('.conversation-item').forEach((el) => {
    el.classList.toggle('is-active', Number(el.dataset.id) === currentConversationId);
  });
}

function renderConversationList(conversations) {
  if (!conversations.length) {
    conversationList.innerHTML = '<div class="ai-chat-history-empty">Belum ada percakapan tersimpan.</div>';
    return;
  }
  conversationList.innerHTML = conversations
    .map(
      (c) => `
    <div class="conversation-item" data-id="${c.id}">
      <div class="conversation-item-main">
        <div class="conversation-item-title">${escapeHtml(c.title)}</div>
        <div class="conversation-item-time">${timeAgo(c.updated_at)}</div>
      </div>
      <button type="button" class="conversation-item-delete" data-id="${c.id}" title="Hapus percakapan">
        ${icon('trash')}
      </button>
    </div>
  `
    )
    .join('');
  highlightActiveConversation();

  conversationList.querySelectorAll('.conversation-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.conversation-item-delete')) return;
      openConversation(Number(el.dataset.id));
    });
  });
  conversationList.querySelectorAll('.conversation-item-delete').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      if (!confirm('Hapus percakapan ini? Tidak bisa dibatalkan.')) return;
      try {
        await api(`/ai-chat/conversations/${id}`, { method: 'DELETE' });
        if (currentConversationId === id) startNewConversation();
        await loadConversations();
      } catch (err) {
        showMessage(err.message, true);
      }
    });
  });
}

async function loadConversations() {
  try {
    const res = await api('/ai-chat/conversations');
    renderConversationList(res.data);
  } catch (err) {
    conversationList.innerHTML = '<div class="ai-chat-history-empty">Gagal memuat riwayat percakapan.</div>';
  }
}

async function openConversation(id) {
  if (sending) return;
  try {
    const res = await api(`/ai-chat/conversations/${id}`);
    currentConversationId = res.data.id;
    resetChatWindow();
    res.data.messages.forEach((m) => appendBubble(m.role, m.content));
    highlightActiveConversation();
  } catch (err) {
    showMessage(err.message, true);
  }
}

newChatBtn.addEventListener('click', startNewConversation);

async function sendMessage(text) {
  if (sending || !text.trim()) return;
  sending = true;
  chatSendBtn.disabled = true;
  resultBox.style.display = 'none';

  appendBubble('user', text.trim());
  appendTyping();

  try {
    const res = await api('/ai-chat/query', {
      method: 'POST',
      body: JSON.stringify({ message: text.trim(), conversation_id: currentConversationId }),
    });
    removeTyping();
    let note = '';
    if (res.data.fallback_used) {
      note = `Dijawab oleh AI lokal (${res.data.model}) -- kredit OpenRouter sedang habis/bermasalah`;
    } else if (res.data.provider === 'ollama') {
      note = `Dijawab oleh AI lokal (${res.data.model})`;
    }
    appendBubble('assistant', res.data.reply, false, note);
    currentConversationId = res.data.conversation_id;
    await loadConversations();
  } catch (err) {
    removeTyping();
    appendBubble('assistant', err.message, true);
  } finally {
    sending = false;
    chatSendBtn.disabled = false;
  }
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value;
  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendMessage(text);
});

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 140)}px`;
});

document.querySelectorAll('.chat-suggestion-btn').forEach((btn) => {
  btn.addEventListener('click', () => sendMessage(btn.dataset.q));
});

loadRoutingStatus();
loadConversations();
