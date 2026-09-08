(() => {
  const root = document.body.dataset.root || '';
  const appBaseUrl = new URL(root || './', window.location.href);
  const appUrl = path => new URL(path, appBaseUrl).href;

  const nav = document.querySelector('[data-app-nav]');
  if (nav) {
    const active = nav.dataset.active || '';
    const items = [
      ['home', 'Home', 'index.html', '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/>'],
      ['calendar', 'Calendar', 'calendar.html', '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16"/>'],
      ['bible', 'Bible', 'study-bible.html', '<path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v17H7.5A2.5 2.5 0 0 0 5 21.5z"/><path d="M5 4.5v17M9 6h6M12 5v5"/>'],
      ['pray', 'Pray', 'prayers.html', '<path d="M12 4v16M8.5 8h7"/><path d="M6 21h12"/>'],
      ['listen', 'Listen', 'listen.html', '<path d="M5 10v4M9 7v10M13 4v16M17 8v8M21 10v4"/>']
    ];
    nav.className = 'oa-dock';
    nav.setAttribute('aria-label', 'Main navigation');
    nav.innerHTML = items.map(([key,label,href,icon]) => `
      <a class="oa-dock-link ${key === active ? 'is-active' : ''}" href="${root}${href}" ${key === active ? 'aria-current="page"' : ''}>
        <svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>
        <span>${label}</span>
      </a>`).join('');
  }

  const dateEl = document.querySelector('[data-today-date]');
  if (dateEl) {
    const d = new Date();
    dateEl.textContent = new Intl.DateTimeFormat(undefined, { weekday:'long', day:'numeric', month:'long' }).format(d);
  }

  /* All pages use the app navigation now, so remove legacy back links if an older cached page contains one. */
  document.querySelectorAll('.back-link, .calendar-selector-link, [data-back-button]').forEach(el => el.remove());

  /* Shared footer. Keep it deliberately thin. */
  document.querySelectorAll('.app-footer, .oa-site-footer').forEach(el => el.remove());
  const footer = document.createElement('footer');
  footer.className = 'oa-site-footer';
  footer.innerHTML = `<span class="oa-site-footer-copyright">© 2026 Daily Orthodox Life · dailyorthodoxlife.com</span>`;

  const footerHost = document.querySelector('.app-shell') || document.querySelector('.reader-page') || document.querySelector('.oa-page') || document.body;
  footerHost.appendChild(footer);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register(root + 'sw.js').catch(() => {}));
  }

  (() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const targets = document.querySelectorAll('.oa-section-head, .oa-quick-grid, .oa-card-row, .oa-feature-grid, .oa-calendar-choice-grid, .oa-prayer-grid, .oa-track-list, .oa-recorded-empty, .liturgical-masthead, body.app-calendar-page .today-section, body.app-calendar-page .right-panel > section');
    targets.forEach(el => el.classList.add('oa-reveal'));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -18px' });
    targets.forEach(el => observer.observe(el));
  })();

  /* Shared audio player. It restores the same track and playback position after normal page navigation. */
  const tracks = [
    {title:'Agni Parthene', tradition:'Greek', meta:'Greek Orthodox chant', src:'greek/greek-assets/music/Agni Parthene.mp3'},
    {title:'Come on people', tradition:'Greek', meta:'Greek Orthodox chant', src:'greek/greek-assets/music/Come on people.mp3'},
    {title:'Praise the Lord from the Heavens', tradition:'Greek', meta:'Greek Orthodox chant', src:'greek/greek-assets/music/Praise the Lord from the Heavens.mp3'},
    {title:'Psalm 135', tradition:'Greek', meta:'Greek Orthodox chant', src:'greek/greek-assets/music/Psalm 135.mp3'},
    {title:'Psalm 50', tradition:'Greek', meta:'Greek Orthodox chant', src:'greek/greek-assets/music/Psalm 50.mp3'},
    {title:'Belisarius', tradition:'Russian', meta:'Russian Orthodox chant', src:'russian/russian-assets/music/Belisarius.mp3'},
    {title:'Hymn of the Cherubim', tradition:'Russian', meta:'Russian Orthodox chant', src:'russian/russian-assets/music/Hymn of the Cherubim.mp3'},
    {title:'Lord, I have cried unto Thee', tradition:'Russian', meta:'Russian Orthodox chant', src:'russian/russian-assets/music/Lord, I have cried unto Thee.mp3'},
    {title:'My Sinful Soul', tradition:'Russian', meta:'Russian Orthodox chant', src:'russian/russian-assets/music/My Sinful Soul.mp3'},
    {title:'We Praise Thee', tradition:'Russian', meta:'Russian Orthodox chant', src:'russian/russian-assets/music/We Praise Thee.mp3'}
  ];

  const isEmbeddedAppPage = window.self !== window.top;

  /* Pages loaded inside the persistent app frame control the parent's audio player. */
  if (isEmbeddedAppPage) {
    document.querySelectorAll('#audio, #audio-player').forEach(el => el.remove());

    const proxyState = { index: -1, playing: false };
    const sendAudioCommand = (command, value) => {
      try { window.parent.postMessage({ type: 'orthodox-audio-command', command, value }, '*'); } catch (_) {}
    };

    window.OrthodoxAudio = {
      tracks,
      start(i) { sendAudioCommand('start', Number(i)); },
      shuffle() { sendAudioCommand('shuffle'); },
      toggle() { sendAudioCommand('toggle'); },
      close() { sendAudioCommand('close'); },
      get currentIndex() { return proxyState.index; },
      get isPlaying() { return proxyState.playing; },
      get audio() { return null; }
    };

    window.addEventListener('message', event => {
      const data = event.data || {};
      if (data.type !== 'orthodox-audio-state') return;
      proxyState.index = Number.isInteger(data.index) ? data.index : -1;
      proxyState.playing = Boolean(data.playing);
      window.dispatchEvent(new CustomEvent('orthodoxaudiochange', { detail: { index: proxyState.index, playing: proxyState.playing } }));
    });

    /* Keep navigation inside the persistent top-level shell so audio never unloads. */
    document.addEventListener('click', event => {
      const link = event.target.closest?.('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const raw = link.getAttribute('href') || '';
      if (!raw || raw.startsWith('#') || raw.startsWith('javascript:') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return;
      let target;
      try { target = new URL(raw, window.location.href); } catch (_) { return; }
      const sameApp = target.protocol === 'file:'
        ? target.pathname.startsWith(appBaseUrl.pathname)
        : target.origin === appBaseUrl.origin;
      const navigable = /\.html$/i.test(target.pathname) || target.pathname.endsWith('/');
      if (!sameApp || !navigable) return;
      event.preventDefault();
      try { window.parent.postMessage({ type: 'orthodox-route', href: target.href }, '*'); } catch (_) {}
    }, true);

    try { window.parent.postMessage({ type: 'orthodox-audio-child-ready' }, '*'); } catch (_) {}
    return;
  }

  const STORAGE_KEY = 'orthodoxAudioStateV1';
  const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7.4 17.2 12 9 16.6Z" fill="currentColor" stroke="none"/></svg>';
  const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h3v12H8zM13 6h3v12h-3z" fill="currentColor" stroke="none"/></svg>';
  const previousIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14M18 6l-8 6 8 6z"/></svg>';
  const nextIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 5v14M6 6l8 6-8 6z"/></svg>';
  const stopwatchIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 2h6M12 5v2M17.5 6.5l1.5-1.5M12 7a7 7 0 1 1-7 7 7 7 0 0 1 7-7z"/><path d="M12 10v4l2.5 1.5"/></svg>';
  const fmt = seconds => {
    if (!Number.isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  let audio = document.getElementById('audio');
  if (!audio) {
    audio = document.createElement('audio');
    audio.id = 'audio';
    audio.preload = 'metadata';
    document.body.appendChild(audio);
  }

  let player = document.getElementById('audio-player');
  if (!player) {
    player = document.createElement('div');
    player.id = 'audio-player';
    player.className = 'oa-player oa-global-player';
    player.innerHTML = `
      <div class="oa-player-meta"><strong id="audio-player-title">Sacred audio</strong><span id="audio-player-meta">Select a recording</span></div>
      <div class="oa-player-controls">
        <button id="audio-player-prev" class="oa-player-btn" type="button" aria-label="Previous">${previousIcon}</button>
        <button id="audio-player-play" class="oa-player-btn play" type="button" aria-label="Play or pause">${playIcon}</button>
        <button id="audio-player-next" class="oa-player-btn" type="button" aria-label="Next">${nextIcon}</button>
      </div>
      <div class="oa-player-tools">
        <div class="oa-player-volume" aria-label="Volume controls">
          <button id="audio-volume-down" class="oa-volume-step" type="button" aria-label="Lower volume">−</button>
          <input id="audio-volume" type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume" />
          <button id="audio-volume-up" class="oa-volume-step" type="button" aria-label="Raise volume">+</button>
        </div>
        <button id="audio-sleep-timer" class="oa-player-timer" type="button" aria-label="Set sleep timer" aria-expanded="false">${stopwatchIcon}<span id="audio-sleep-timer-badge" aria-hidden="true"></span></button>
        <button id="audio-player-close" class="oa-player-close" type="button" aria-label="Close audio player">×</button>
        <div id="audio-sleep-panel" class="oa-sleep-panel" hidden>
          <strong>Sleep timer</strong>
          <span class="oa-sleep-note">Fade out and stop after:</span>
          <div class="oa-sleep-presets" role="group" aria-label="Sleep timer presets">
            <button type="button" data-sleep-minutes="15">15 min</button>
            <button type="button" data-sleep-minutes="30">30 min</button>
            <button type="button" data-sleep-minutes="45">45 min</button>
            <button type="button" data-sleep-minutes="60">1 hour</button>
            <button type="button" data-sleep-minutes="90">90 min</button>
          </div>
          <div class="oa-sleep-custom">
            <label for="audio-sleep-custom">Custom</label>
            <input id="audio-sleep-custom" type="number" min="1" max="480" inputmode="numeric" placeholder="Minutes" />
            <button id="audio-sleep-custom-set" type="button">Set</button>
          </div>
          <button id="audio-sleep-cancel" class="oa-sleep-cancel" type="button" hidden>Cancel timer</button>
        </div>
      </div>
      <div class="oa-player-progress"><span id="audio-current">0:00</span><input id="audio-scrub" type="range" min="0" max="100" value="0" aria-label="Playback position" /><span id="audio-duration">0:00</span></div>`;
    document.body.appendChild(player);
  } else {
    let tools = player.querySelector('.oa-player-tools');
    if (!tools) {
      tools = document.createElement('div');
      tools.className = 'oa-player-tools';
      const progress = player.querySelector('.oa-player-progress');
      player.insertBefore(tools, progress || null);
    }

    if (!player.querySelector('#audio-volume')) {
      const volume = document.createElement('div');
      volume.className = 'oa-player-volume';
      volume.setAttribute('aria-label', 'Volume controls');
      volume.innerHTML = `
        <button id="audio-volume-down" class="oa-volume-step" type="button" aria-label="Lower volume">−</button>
        <input id="audio-volume" type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume" />
        <button id="audio-volume-up" class="oa-volume-step" type="button" aria-label="Raise volume">+</button>`;
      tools.appendChild(volume);
    }

    let timer = player.querySelector('#audio-sleep-timer');
    if (!timer) {
      timer = document.createElement('button');
      timer.id = 'audio-sleep-timer';
      timer.className = 'oa-player-timer';
      timer.type = 'button';
      timer.setAttribute('aria-label', 'Set sleep timer');
      timer.setAttribute('aria-expanded', 'false');
      timer.innerHTML = `${stopwatchIcon}<span id="audio-sleep-timer-badge" aria-hidden="true"></span>`;
    }
    tools.appendChild(timer);

    let close = player.querySelector('#audio-player-close');
    if (!close) {
      close = document.createElement('button');
      close.id = 'audio-player-close';
      close.className = 'oa-player-close';
      close.type = 'button';
      close.setAttribute('aria-label', 'Close audio player');
      close.textContent = '×';
    }
    tools.appendChild(close);

    let panel = player.querySelector('#audio-sleep-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'audio-sleep-panel';
      panel.className = 'oa-sleep-panel';
      panel.hidden = true;
      panel.innerHTML = `
        <strong>Sleep timer</strong>
        <span class="oa-sleep-note">Fade out and stop after:</span>
        <div class="oa-sleep-presets" role="group" aria-label="Sleep timer presets">
          <button type="button" data-sleep-minutes="15">15 min</button>
          <button type="button" data-sleep-minutes="30">30 min</button>
          <button type="button" data-sleep-minutes="45">45 min</button>
          <button type="button" data-sleep-minutes="60">1 hour</button>
          <button type="button" data-sleep-minutes="90">90 min</button>
        </div>
        <div class="oa-sleep-custom">
          <label for="audio-sleep-custom">Custom</label>
          <input id="audio-sleep-custom" type="number" min="1" max="480" inputmode="numeric" placeholder="Minutes" />
          <button id="audio-sleep-custom-set" type="button">Set</button>
        </div>
        <button id="audio-sleep-cancel" class="oa-sleep-cancel" type="button" hidden>Cancel timer</button>`;
    }
    tools.appendChild(panel);
  }

  const ui = {
    title: player.querySelector('#audio-player-title'),
    meta: player.querySelector('#audio-player-meta'),
    play: player.querySelector('#audio-player-play'),
    prev: player.querySelector('#audio-player-prev'),
    next: player.querySelector('#audio-player-next'),
    close: player.querySelector('#audio-player-close'),
    volume: player.querySelector('#audio-volume'),
    volumeDown: player.querySelector('#audio-volume-down'),
    volumeUp: player.querySelector('#audio-volume-up'),
    timer: player.querySelector('#audio-sleep-timer'),
    timerBadge: player.querySelector('#audio-sleep-timer-badge'),
    sleepPanel: player.querySelector('#audio-sleep-panel'),
    sleepCustom: player.querySelector('#audio-sleep-custom'),
    sleepCustomSet: player.querySelector('#audio-sleep-custom-set'),
    sleepCancel: player.querySelector('#audio-sleep-cancel'),
    scrub: player.querySelector('#audio-scrub'),
    current: player.querySelector('#audio-current'),
    duration: player.querySelector('#audio-duration')
  };

  let index = -1;
  let desiredPlaying = false;
  let shuffleMode = false;
  let leaving = false;
  let lastPersistAt = 0;
  let sleepTimerEnd = 0;
  let sleepTimerTimeout = null;
  let sleepTimerTicker = null;
  let fadeInterval = null;
  let userVolume = 1;

  const WINDOW_STATE_PREFIX = 'orthodoxAudio:';
  const readState = () => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
      if (stored) return stored;
    } catch (_) {}
    try {
      if (typeof window.name === 'string' && window.name.startsWith(WINDOW_STATE_PREFIX)) {
        return JSON.parse(window.name.slice(WINDOW_STATE_PREFIX.length));
      }
    } catch (_) {}
    return null;
  };

  function persist(force = false) {
    if (index < 0) return;
    const now = Date.now();
    if (!force && now - lastPersistAt < 800) return;
    lastPersistAt = now;
    const state = {
      index,
      currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      playing: desiredPlaying,
      shuffle: shuffleMode,
      sleepTimerEnd: sleepTimerEnd || 0,
      volume: userVolume,
      updatedAt: now,
      closed: false
    };
    const encoded = JSON.stringify(state);
    try { sessionStorage.setItem(STORAGE_KEY, encoded); } catch (_) {}
    try { window.name = WINDOW_STATE_PREFIX + encoded; } catch (_) {}
  }

  function clearState() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
    try { if (window.name.startsWith(WINDOW_STATE_PREFIX)) window.name = ''; } catch (_) {}
  }

  let persistentFrame = null;

  function sendStateToFrame() {
    if (!persistentFrame?.contentWindow) return;
    try { persistentFrame.contentWindow.postMessage({ type: 'orthodox-audio-state', index, playing: !audio.paused }, '*'); } catch (_) {}
  }

  function dispatch() {
    window.dispatchEvent(new CustomEvent('orthodoxaudiochange', { detail: { index, playing: !audio.paused, desiredPlaying } }));
    sendStateToFrame();
  }

  function setMediaSession(track) {
    if (!('mediaSession' in navigator) || !track) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.meta, album: 'Daily Orthodox Life' });
    } catch (_) {}
  }

  function setTrack(nextIndex, options = {}) {
    if (typeof options.shuffle === 'boolean') shuffleMode = options.shuffle;
    index = (nextIndex + tracks.length) % tracks.length;
    const track = tracks[index];
    ui.title.textContent = track.title;
    ui.meta.textContent = track.meta;
    audio.src = appUrl(track.src);
    player.classList.add('is-visible');
    setMediaSession(track);

    const seekTo = Math.max(0, Number(options.currentTime) || 0);
    const begin = () => {
      const target = Number.isFinite(audio.duration) && audio.duration > 0 ? Math.min(seekTo, Math.max(0, audio.duration - .25)) : seekTo;
      try { audio.currentTime = target; } catch (_) {}
      if (options.play) {
        desiredPlaying = true;
        audio.play().catch(() => {
          ui.play.innerHTML = playIcon;
          dispatch();
        });
      } else {
        desiredPlaying = false;
        ui.play.innerHTML = playIcon;
      }
      persist(true);
      dispatch();
    };

    if (audio.readyState >= 1) begin();
    else audio.addEventListener('loadedmetadata', begin, { once: true });
  }

  function randomIndex(excludeIndex = -1) {
    if (tracks.length <= 1) return 0;
    let next = Math.floor(Math.random() * tracks.length);
    while (next === excludeIndex) next = Math.floor(Math.random() * tracks.length);
    return next;
  }

  function start(nextIndex) {
    setTrack(nextIndex, { currentTime: 0, play: true, shuffle: false });
  }

  function startRandom() {
    setTrack(randomIndex(index), { currentTime: 0, play: true, shuffle: true });
  }

  function nextTrack() {
    if (shuffleMode) startRandom();
    else start(index >= tracks.length - 1 ? 0 : index + 1);
  }

  function previousTrack() {
    if (shuffleMode) startRandom();
    else start(index <= 0 ? tracks.length - 1 : index - 1);
  }

  function toggle() {
    if (index < 0) {
      startRandom();
      return;
    }
    if (audio.paused) {
      desiredPlaying = true;
      audio.play().catch(() => {});
    } else {
      desiredPlaying = false;
      audio.pause();
    }
    persist(true);
    dispatch();
  }

  function setUserVolume(value, shouldPersist = true) {
    const next = Number(value);
    userVolume = Number.isFinite(next) ? Math.max(0, Math.min(1, next)) : 1;
    if (!fadeInterval) audio.volume = userVolume;
    if (ui.volume) ui.volume.value = String(userVolume);
    if (shouldPersist) persist(true);
  }

  function changeVolume(delta) {
    setUserVolume(Math.round((userVolume + delta) * 20) / 20);
  }

  function formatSleepRemaining(ms) {
    const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return mins ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${totalMinutes}m`;
  }

  function updateSleepTimerUi() {
    const remaining = sleepTimerEnd - Date.now();
    const active = sleepTimerEnd > Date.now();

    if (ui.timer) {
      ui.timer.classList.toggle('is-active', active);
      ui.timer.setAttribute('aria-label', active
        ? `Sleep timer set, ${formatSleepRemaining(remaining)} remaining`
        : 'Set sleep timer');
    }
    if (ui.timerBadge) {
      ui.timerBadge.textContent = active ? formatSleepRemaining(remaining) : '';
    }
    if (ui.sleepCancel) ui.sleepCancel.hidden = !active;
  }

  function clearSleepTimer(options = {}) {
    if (sleepTimerTimeout) clearTimeout(sleepTimerTimeout);
    if (sleepTimerTicker) clearInterval(sleepTimerTicker);
    if (fadeInterval) clearInterval(fadeInterval);
    sleepTimerTimeout = null;
    sleepTimerTicker = null;
    fadeInterval = null;
    sleepTimerEnd = 0;
    if (options.restoreVolume !== false) audio.volume = userVolume;
    updateSleepTimerUi();
    if (options.persist !== false) persist(true);
  }

  function finishSleepTimer() {
    if (sleepTimerTimeout) clearTimeout(sleepTimerTimeout);
    if (sleepTimerTicker) clearInterval(sleepTimerTicker);
    sleepTimerTimeout = null;
    sleepTimerTicker = null;

    const fadeMs = 30000;
    const stepMs = 200;
    const startVolume = Math.max(0, Math.min(1, audio.volume));
    const startedAt = performance.now();

    if (fadeInterval) clearInterval(fadeInterval);
    fadeInterval = setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / fadeMs);
      const eased = progress * progress * (3 - (2 * progress));
      audio.volume = startVolume * Math.max(0, 1 - eased);

      if (progress >= 1) {
        clearInterval(fadeInterval);
        fadeInterval = null;
        sleepTimerEnd = 0;
        audio.volume = 0;
        setTimeout(() => {
          closePlayer();
          audio.volume = userVolume;
          updateSleepTimerUi();
        }, 350);
      }
    }, stepMs);
  }

  function armSleepTimerAt(endTime) {
    clearSleepTimer({ persist: false, restoreVolume: true });
    sleepTimerEnd = Number(endTime) || 0;
    const remaining = sleepTimerEnd - Date.now();

    if (remaining <= 0) {
      sleepTimerEnd = 0;
      updateSleepTimerUi();
      return;
    }

    sleepTimerTimeout = setTimeout(finishSleepTimer, remaining);
    sleepTimerTicker = setInterval(updateSleepTimerUi, 15000);
    updateSleepTimerUi();
    persist(true);
  }

  function setSleepTimerMinutes(minutes) {
    const mins = Math.max(1, Math.min(480, Math.round(Number(minutes) || 0)));
    if (!mins) return;
    armSleepTimerAt(Date.now() + (mins * 60000));
    if (ui.sleepPanel) ui.sleepPanel.hidden = true;
    if (ui.timer) ui.timer.setAttribute('aria-expanded', 'false');
  }

  function closePlayer() {
    clearSleepTimer({ persist: false, restoreVolume: false });
    desiredPlaying = false;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    index = -1;
    player.classList.remove('is-visible');
    clearState();
    dispatch();
  }

  ui.play?.addEventListener('click', toggle);
  ui.prev?.addEventListener('click', previousTrack);
  ui.next?.addEventListener('click', nextTrack);
  ui.close?.addEventListener('click', closePlayer);
  ui.volume?.addEventListener('input', () => setUserVolume(ui.volume.value));
  ui.volumeDown?.addEventListener('click', () => changeVolume(-0.1));
  ui.volumeUp?.addEventListener('click', () => changeVolume(0.1));

  ui.timer?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!ui.sleepPanel) return;
    const opening = ui.sleepPanel.hidden;
    ui.sleepPanel.hidden = !opening;
    ui.timer.setAttribute('aria-expanded', String(opening));
    if (opening) updateSleepTimerUi();
  });

  player.querySelectorAll('[data-sleep-minutes]').forEach(button => {
    button.addEventListener('click', () => setSleepTimerMinutes(button.dataset.sleepMinutes));
  });

  ui.sleepCustomSet?.addEventListener('click', () => {
    const minutes = Number(ui.sleepCustom?.value);
    if (Number.isFinite(minutes) && minutes >= 1) {
      setSleepTimerMinutes(minutes);
      if (ui.sleepCustom) ui.sleepCustom.value = '';
    } else {
      ui.sleepCustom?.focus();
    }
  });

  ui.sleepCustom?.addEventListener('keydown', event => {
    if (event.key === 'Enter') ui.sleepCustomSet?.click();
  });

  ui.sleepCancel?.addEventListener('click', () => {
    clearSleepTimer();
    if (ui.sleepPanel) ui.sleepPanel.hidden = true;
    if (ui.timer) ui.timer.setAttribute('aria-expanded', 'false');
  });

  document.addEventListener('click', event => {
    if (!ui.sleepPanel || ui.sleepPanel.hidden) return;
    if (player.contains(event.target) && (ui.sleepPanel.contains(event.target) || ui.timer?.contains(event.target))) return;
    ui.sleepPanel.hidden = true;
    ui.timer?.setAttribute('aria-expanded', 'false');
  });

  ui.scrub?.addEventListener('input', () => {
    if (audio.duration) audio.currentTime = (Number(ui.scrub.value) / 100) * audio.duration;
    persist(true);
  });

  audio.addEventListener('timeupdate', () => {
    if (ui.scrub) ui.scrub.value = audio.duration ? String((audio.currentTime / audio.duration) * 100) : '0';
    if (ui.current) ui.current.textContent = fmt(audio.currentTime);
    if (ui.duration) ui.duration.textContent = fmt(audio.duration);
    persist();
  });
  audio.addEventListener('durationchange', () => { if (ui.duration) ui.duration.textContent = fmt(audio.duration); });
  audio.addEventListener('play', () => {
    desiredPlaying = true;
    if (ui.play) ui.play.innerHTML = pauseIcon;
    player.classList.add('is-visible');
    persist(true);
    dispatch();
  });
  audio.addEventListener('pause', () => {
    if (!leaving) desiredPlaying = false;
    if (ui.play) ui.play.innerHTML = playIcon;
    persist(true);
    dispatch();
  });
  audio.addEventListener('ended', nextTrack);

  function isInternalAppPage(target) {
    const sameApp = target.protocol === 'file:'
      ? target.pathname.startsWith(appBaseUrl.pathname)
      : target.origin === appBaseUrl.origin;
    const navigable = /\.html$/i.test(target.pathname) || target.pathname.endsWith('/');
    return sameApp && navigable;
  }

  function openPersistentRoute(href, pushHistory = true) {
    let target;
    try { target = new URL(href, window.location.href); } catch (_) { return; }
    if (!isInternalAppPage(target)) {
      window.location.href = target.href;
      return;
    }

    if (!persistentFrame) {
      persistentFrame = document.createElement('iframe');
      persistentFrame.className = 'oa-persistent-frame';
      persistentFrame.title = 'Daily Orthodox Life';
      persistentFrame.setAttribute('allow', 'autoplay');
      document.body.appendChild(persistentFrame);
      document.documentElement.classList.add('oa-persistent-audio-shell');
    }

    if (pushHistory && window.location.href !== target.href) {
      try { history.pushState({ orthodoxPersistentRoute: target.href }, '', target.href); } catch (_) {}
    }
    if (persistentFrame.src !== target.href) persistentFrame.src = target.href;
    window.scrollTo(0, 0);
  }

  /* Once audio is active, keep the top document alive and load internal pages in
     the app frame. The audio element stays in the top document, so there is no
     stop/restart between pages. */
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    let target;
    try { target = new URL(href, window.location.href); } catch (_) { return; }
    if (index >= 0 && isInternalAppPage(target)) {
      event.preventDefault();
      persist(true);
      openPersistentRoute(target.href, true);
    }
  }, true);

  window.addEventListener('message', event => {
    const data = event.data || {};

    if (data.type === 'orthodox-route' && typeof data.href === 'string') {
      openPersistentRoute(data.href, true);
      return;
    }

    if (data.type === 'orthodox-audio-child-ready') {
      sendStateToFrame();
      return;
    }

    if (data.type !== 'orthodox-audio-command') return;
    switch (data.command) {
      case 'start':
        if (Number.isFinite(Number(data.value))) start(Number(data.value));
        break;
      case 'shuffle':
        startRandom();
        break;
      case 'toggle':
        toggle();
        break;
      case 'close':
        closePlayer();
        break;
      default:
        break;
    }
  });

  window.addEventListener('popstate', event => {
    const route = event.state?.orthodoxPersistentRoute;
    if (!persistentFrame) return;
    if (route) {
      openPersistentRoute(route, false);
      return;
    }
    persistentFrame.remove();
    persistentFrame = null;
    document.documentElement.classList.remove('oa-persistent-audio-shell');
    sendStateToFrame();
  });

  window.addEventListener('pagehide', () => {
    leaving = true;
    persist(true);
  });

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => { desiredPlaying = true; audio.play().catch(() => {}); });
      navigator.mediaSession.setActionHandler('pause', () => { desiredPlaying = false; audio.pause(); });
      navigator.mediaSession.setActionHandler('previoustrack', previousTrack);
      navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
    } catch (_) {}
  }

  const restored = readState();
  if (restored && Number.isFinite(Number(restored.volume))) setUserVolume(Number(restored.volume), false);
  else setUserVolume(1, false);

  if (restored?.sleepTimerEnd && Number(restored.sleepTimerEnd) > Date.now()) {
    armSleepTimerAt(Number(restored.sleepTimerEnd));
  } else {
    updateSleepTimerUi();
  }

  if (restored && Number.isInteger(restored.index) && restored.index >= 0 && restored.index < tracks.length) {
    setTrack(restored.index, {
      currentTime: Number(restored.currentTime) || 0,
      play: Boolean(restored.playing),
      shuffle: Boolean(restored.shuffle)
    });
  }

  window.OrthodoxAudio = {
    tracks,
    start,
    shuffle: startRandom,
    toggle,
    close: closePlayer,
    get currentIndex() { return index; },
    get audio() { return audio; },
    get isPlaying() { return !audio.paused; }
  };
})();
