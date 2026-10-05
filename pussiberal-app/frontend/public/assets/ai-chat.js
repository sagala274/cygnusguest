requireAuth();
requireRole('admin');
renderNav('ai-chat');

const resultBox = document.getElementById('resultBox');
const chatWindow = document.getElementById('chatWindow');
const chatEmpty = document.getElementById('chatEmpty');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');

const history = [];
let sending = false;

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
      body: JSON.stringify({ message: text.trim(), history }),
    });
    removeTyping();
    const note = res.data.fallback_used ? `Dijawab oleh AI lokal (${res.data.model}) -- kredit OpenRouter sedang habis/bermasalah` : '';
    appendBubble('assistant', res.data.reply, false, note);
    history.push({ role: 'user', content: text.trim() });
    history.push({ role: 'assistant', content: res.data.reply });
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
