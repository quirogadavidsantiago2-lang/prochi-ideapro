(() => {
  'use strict';

  const requestTimeout = 60_000;
  const maxMessageLength = 4_000;
  const maxHistoryLength = 40;
  const storageKey = 'ideapro_prochi_chat_v3';
  const locale = 'es-CO';
  const formatTime = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  const get = (id) => document.getElementById(id);

  const form = get('chatForm');
  const input = get('chatInput');
  const send = get('send');
  const newChat = get('newChat');
  const dictation = get('dictation');
  const welcome = get('welcome');
  const transcript = get('transcript');
  const pending = get('pending');
  const scroll = get('chatScroll');
  const connection = get('connection');
  const notice = get('notice');
  const toast = get('toast');
  const promptButtons = [...document.querySelectorAll('[data-prompt]')];
  const endpoint = configuredEndpoint();
  let { sessionId, messages } = loadChat();
  let busy = false;
  let toastTimer;
  let recognition;

  function configuredEndpoint() {
    const config = window.PROCHI_CONFIG ?? {};
    const localHosts = ['localhost', '127.0.0.1', '[::1]'];
    const local = localHosts.includes(location.hostname);
    const value = config.webhookUrl?.trim() || (local ? config.localWebhookUrl?.trim() : '');
    if (!value) return null;
    try {
      const url = new URL(value, location.href);
      if (url.username || url.password || url.hash) return null;
      if (url.protocol === 'https:' || (local && url.protocol === 'http:' && localHosts.includes(url.hostname))) {
        return url.href;
      }
    } catch {
      return null;
    }
    return null;
  }

  function createSession() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  function loadChat() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      if (/^[a-f\d-]{32,36}$/i.test(saved?.sessionId) && Array.isArray(saved.messages)) {
        const validMessages = saved.messages.filter((message) =>
          ['user', 'bot'].includes(message?.role) &&
          typeof message.text === 'string' && message.text.length <= 32_000 &&
          Number.isFinite(message.time) && Math.abs(message.time) <= 8.64e15,
        );
        return { sessionId: saved.sessionId, messages: validMessages.slice(-maxHistoryLength) };
      }
    } catch {
      // A blocked storage API must not prevent chatting.
    }
    return { sessionId: createSession(), messages: [] };
  }

  function saveChat() {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ sessionId, messages }));
    } catch {
      // This tab can still continue with its in-memory conversation.
    }
  }

  function status(state, label) {
    connection.dataset.state = state;
    connection.textContent = label;
  }

  function showNotice(message = '') {
    notice.textContent = message;
    notice.hidden = !message;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2700);
  }

  function updateInput() {
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
    send.disabled = !endpoint || busy || !input.value.trim();
  }

  function updateBusy(isBusy) {
    busy = isBusy;
    pending.hidden = !isBusy;
    input.readOnly = isBusy;
    newChat.disabled = isBusy;
    dictation.disabled = isBusy;
    for (const button of promptButtons) button.disabled = isBusy || !endpoint;
    updateInput();
  }

  function bottom() {
    scroll.scrollTop = scroll.scrollHeight;
  }

  function appendFormattedText(container, text) {
    const tokens = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`|\[([^\]\n]+)\]\(([^\s)]+)\)|https?:\/\/[^\s<>()]+/gi;
    let previousEnd = 0;
    for (const match of text.matchAll(tokens)) {
      const [original, bold, italic, code, label, href] = match;
      container.append(text.slice(previousEnd, match.index));
      previousEnd = match.index + original.length;

      if (bold || italic || code) {
        const emphasis = document.createElement(bold ? 'strong' : italic ? 'em' : 'code');
        emphasis.textContent = bold || italic || code;
        container.append(emphasis);
        continue;
      }

      const address = href || original.replace(/[.,;!?]+$/, '');
      try {
        const url = new URL(address);
        if (!['https:', 'http:', 'mailto:'].includes(url.protocol) || url.username || url.password) {
          container.append(original);
          continue;
        }
        const link = document.createElement('a');
        link.href = url.href;
        link.textContent = label || address;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        container.append(link);
        if (!href) container.append(original.slice(address.length));
      } catch {
        container.append(original);
      }
    }
    container.append(text.slice(previousEnd));
  }

  function renderMessage(message) {
    const article = document.createElement('article');
    article.className = 'message';
    article.dataset.role = message.role;

    const author = document.createElement('p');
    author.className = 'message-heading';
    author.textContent = message.role === 'user' ? 'Tú' : 'PROCHI';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (message.role === 'user') {
      bubble.textContent = message.text;
    } else {
      if (message.type === 'agendar_cita') {
        const booking = document.createElement('div');
        booking.className = 'booking-label';
        booking.textContent = 'Cita agendada';
        bubble.append(booking);
      }
      const content = document.createElement('div');
      appendFormattedText(content, message.text);
      bubble.append(content);
    }

    const metadata = document.createElement('div');
    metadata.className = 'message-meta';
    const time = document.createElement('time');
    time.dateTime = new Date(message.time).toISOString();
    time.textContent = formatTime.format(message.time);
    metadata.append(time);

    if (message.role === 'bot' && navigator.clipboard?.writeText) {
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'copy-message';
      copy.textContent = 'Copiar';
      copy.setAttribute('aria-label', 'Copiar respuesta de PROCHI');
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(message.text);
          showToast('Respuesta copiada.');
        } catch {
          showToast('No se pudo copiar la respuesta.');
        }
      });
      metadata.append(copy);
    }

    article.append(author, bubble, metadata);
    transcript.append(article);
    return article;
  }

  function readReply(value) {
    const record = Array.isArray(value) ? value[0] : value;
    const text = typeof record === 'string' ? record : record?.mensaje;
    if (typeof text !== 'string' || !text.trim() || text.length > 32_000) {
      throw new Error('PROCHI devolvió una respuesta incompleta.');
    }
    return { text: text.trim(), type: record?.tipo };
  }

  async function requestReply(message) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeout);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain' },
        body: JSON.stringify({ message, sessionId, source: 'ideapro-prochi-web' }),
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'error',
      });
      if (response.status === 429) throw new Error('PROCHI está recibiendo muchas consultas. Intenta más tarde.');
      if (!response.ok) throw new Error('PROCHI no pudo responder en este momento.');
      const contentType = response.headers.get('Content-Type') ?? '';
      if (contentType.includes('json')) return readReply(await response.json());
      if (contentType.includes('text/plain')) return readReply(await response.text());
      throw new Error('PROCHI devolvió una respuesta incompleta.');
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error('La respuesta tardó demasiado. Si estabas agendando una cita, revisa tu correo antes de volver a enviarla.');
      }
      if (error instanceof TypeError) throw new Error('No se pudo conectar con PROCHI. Tu mensaje sigue en el cuadro de texto.');
      if (error instanceof SyntaxError) throw new Error('PROCHI devolvió una respuesta incompleta.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function sendMessage(value) {
    const text = value.trim();
    if (!endpoint || busy || !text || text.length > maxMessageLength) return;
    recognition?.abort();
    input.value = '';
    showNotice();
    updateBusy(true);
    status('busy', 'Respondiendo');
    welcome.hidden = true;
    const userMessage = { role: 'user', text, time: Date.now() };
    const outgoing = renderMessage(userMessage);
    bottom();

    try {
      const reply = await requestReply(text);
      const response = { role: 'bot', time: Date.now(), ...reply };
      messages.push(userMessage, response);
      messages = messages.slice(-maxHistoryLength);
      saveChat();
      renderMessage(response);
      while (transcript.children.length > maxHistoryLength) transcript.firstElementChild.remove();
      status('online', 'Disponible');
    } catch (error) {
      outgoing.remove();
      welcome.hidden = messages.length > 0;
      input.value = text;
      status('offline', 'Sin respuesta');
      showNotice(error.message);
    } finally {
      updateBusy(false);
      bottom();
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void sendMessage(input.value);
  });

  input.addEventListener('input', updateInput);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !event.repeat) {
      event.preventDefault();
      if (!send.disabled) form.requestSubmit();
    }
  });

  for (const button of promptButtons) {
    button.addEventListener('click', () => {
      const prompt = button.dataset.prompt;
      if (input.value.trim()) {
        input.value = prompt;
        updateInput();
        input.focus();
      } else {
        void sendMessage(prompt);
      }
    });
  }

  newChat.addEventListener('click', () => {
    recognition?.abort();
    sessionId = createSession();
    messages = [];
    saveChat();
    transcript.replaceChildren();
    welcome.hidden = false;
    input.value = '';
    if (endpoint) showNotice();
    updateInput();
    input.focus();
    showToast('Nueva conversación iniciada.');
  });

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition && endpoint) {
    dictation.hidden = false;
    dictation.addEventListener('click', () => {
      if (recognition) {
        recognition.stop();
        return;
      }
      const prefix = input.value.trimEnd();
      const listener = new SpeechRecognition();
      listener.lang = locale;
      listener.interimResults = true;
      listener.addEventListener('result', (event) => {
        if (busy || recognition !== listener) return;
        const spoken = Array.from(event.results, (item) => item[0].transcript).join('').trim();
        input.value = [prefix, spoken].filter(Boolean).join(' ').slice(0, maxMessageLength);
        updateInput();
      });
      listener.addEventListener('error', (event) => {
        if (event.error !== 'aborted') showToast('No se pudo usar el micrófono.');
      });
      listener.addEventListener('end', () => {
        if (recognition === listener) recognition = null;
        dictation.setAttribute('aria-pressed', 'false');
      });
      try {
        listener.start();
        recognition = listener;
        dictation.setAttribute('aria-pressed', 'true');
        showToast('Escuchando…');
      } catch {
        showToast('No se pudo iniciar el dictado.');
      }
    });
  }

  messages.forEach(renderMessage);
  welcome.hidden = messages.length > 0;
  if (endpoint) {
    status('ready', 'Listo');
  } else {
    status('unconfigured', 'Sin conexión');
    showNotice('El chat aún no está conectado. Puedes contactar a IDEAPRO por WhatsApp o correo.');
  }
  updateBusy(false);
  bottom();
})();
