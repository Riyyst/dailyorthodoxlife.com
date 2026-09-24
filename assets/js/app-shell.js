(() => {
  if (window.__dailyOrthodoxAppShellLoaded) return;
  window.__dailyOrthodoxAppShellLoaded = true;

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
    window.addEventListener('load', () => {
      const registerWorker = () => navigator.serviceWorker.register(root + 'sw.js').catch(() => {});
      if ('requestIdleCallback' in window) requestIdleCallback(registerWorker, { timeout: 2500 });
      else setTimeout(registerWorker, 1200);
    });
  }

  /* Site-wide accessibility and language controls. Settings and language persist between pages. */
  (() => {
    const SETTINGS_KEY = 'dailyOrthodoxLifeAccessibilityV1';
    const embedded = window.self !== window.top;
    const supportedLanguages = [
      ['en', 'English'], ['sq', 'Albanian'], ['ar', 'Arabic'], ['bg', 'Bulgarian'],
      ['fr', 'French'], ['ka', 'Georgian'], ['de', 'German'], ['el', 'Greek'],
      ['it', 'Italian'], ['pt', 'Portuguese'], ['ro', 'Romanian'], ['ru', 'Russian'],
      ['sr', 'Serbian'], ['es', 'Spanish'], ['uk', 'Ukrainian']
    ];
    const supportedCodes = new Set(supportedLanguages.map(([code]) => code));

    const deviceLanguage = () => {
      const candidates = [
        ...(Array.isArray(navigator.languages) ? navigator.languages : []),
        navigator.language,
        navigator.userLanguage
      ].filter(Boolean);

      for (const candidate of candidates) {
        const code = String(candidate).toLowerCase().split('-')[0];
        if (supportedCodes.has(code)) return code;
      }
      return 'en';
    };

    const defaultLanguage = deviceLanguage();
    const defaults = {
      fontScale: 1,
      contrast: false,
      reduceMotion: false,
      underlineLinks: false,
      language: defaultLanguage
    };

    const readSettings = () => {
      try {
        const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        const merged = { ...defaults, ...stored };
        if (!supportedCodes.has(merged.language)) merged.language = defaultLanguage;
        return merged;
      } catch (_) {
        return { ...defaults };
      }
    };

    let settings = readSettings();

    const saveSettings = () => {
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {}
    };

    const applySettings = () => {
      const scale = Math.max(.9, Math.min(1.3, Number(settings.fontScale) || 1));
      document.documentElement.style.fontSize = `${16 * scale}px`;
      document.body.classList.toggle('oa-a11y-contrast', Boolean(settings.contrast));
      document.body.classList.toggle('oa-a11y-reduce-motion', Boolean(settings.reduceMotion));
      document.body.classList.toggle('oa-a11y-underline-links', Boolean(settings.underlineLinks));
      document.documentElement.lang = settings.language || defaultLanguage;
    };
    applySettings();

    const writeTranslateCookie = language => {
      const code = supportedCodes.has(language) ? language : defaultLanguage;
      const value = code === 'en' ? '' : `/en/${code}`;
      const expiry = code === 'en'
        ? ';expires=Thu, 01 Jan 1970 00:00:00 GMT'
        : ';max-age=31536000';

      try {
        document.cookie = `googtrans=${value};path=/${expiry};SameSite=Lax`;
        if (location.hostname && location.hostname.includes('.')) {
          const domain = location.hostname.replace(/^www\./, '');
          document.cookie = `googtrans=${value};path=/;domain=.${domain}${expiry};SameSite=Lax`;
        }
      } catch (_) {}
    };

    let translateHost = document.getElementById('google_translate_element');
    if (!translateHost) {
      translateHost = document.createElement('div');
      translateHost.id = 'google_translate_element';
      translateHost.className = 'oa-google-translate-host notranslate';
      translateHost.setAttribute('aria-hidden', 'true');
      document.body.appendChild(translateHost);
    }

    const suppressTranslationChrome = () => {
      document.documentElement.style.setProperty('top', '0px', 'important');
      document.body?.style.setProperty('top', '0px', 'important');
      document.querySelectorAll(
        'iframe.goog-te-banner-frame, .goog-te-banner-frame, .VIpgJd-ZVi9od-ORHb-OEVmcd, .VIpgJd-ZVi9od-aZ2wEe-wOHMyf, .goog-te-balloon-frame'
      ).forEach(el => {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('height', '0', 'important');
        el.setAttribute('aria-hidden', 'true');
      });
    };

    let translateScriptRequested = false;
    let translateApplyTimer = null;
    let lastAppliedLanguage = '';
    let refreshTranslateTimer = null;

    const applyGoogleTranslation = (attempt = 0, force = false) => {
      if (!settings.language || settings.language === 'en') {
        lastAppliedLanguage = 'en';
        suppressTranslationChrome();
        return;
      }

      const combo = document.querySelector('.goog-te-combo');
      if (combo) {
        const target = settings.language;
        if (combo.value !== target) combo.value = target;

        // Important: Google can initialise the dropdown from the googtrans cookie
        // without translating the actual document. Fire one change event even
        // when the dropdown already shows the target language.
        if (force || lastAppliedLanguage !== target) {
          lastAppliedLanguage = target;
          combo.dispatchEvent(new Event('change', { bubbles: true }));
        }

        suppressTranslationChrome();

        if (embedded) {
          setTimeout(() => {
            try { window.parent.postMessage({ type: 'orthodox-translation-ready' }, '*'); } catch (_) {}
          }, 120);
        }
        return;
      }

      // Short, bounded retry only. Never run a long polling loop.
      if (attempt < 12) {
        clearTimeout(translateApplyTimer);
        translateApplyTimer = setTimeout(() => applyGoogleTranslation(attempt + 1, force), 120);
      } else if (embedded) {
        try { window.parent.postMessage({ type: 'orthodox-translation-ready' }, '*'); } catch (_) {}
      }
    };

    const loadGoogleTranslate = () => {
      if (!settings.language || settings.language === 'en') {
        writeTranslateCookie('en');
        suppressTranslationChrome();
        if (embedded) {
          try { window.parent.postMessage({ type: 'orthodox-translation-ready' }, '*'); } catch (_) {}
        }
        return;
      }

      writeTranslateCookie(settings.language);

      if (window.google?.translate?.TranslateElement) {
        applyGoogleTranslation(0, true);
        return;
      }

      if (translateScriptRequested || document.querySelector('script[data-dol-google-translate]')) {
        translateScriptRequested = true;
        return;
      }

      translateScriptRequested = true;
      window.googleTranslateElementInit = () => {
        try {
          new window.google.translate.TranslateElement({
            pageLanguage: 'en',
            includedLanguages: supportedLanguages.map(x => x[0]).filter(x => x !== 'en').join(','),
            autoDisplay: false
          }, 'google_translate_element');

          // One application pass after the widget exists. Force the change
          // event once so a cookie-preselected dropdown still translates.
          setTimeout(() => applyGoogleTranslation(0, true), 90);
          setTimeout(suppressTranslationChrome, 350);
        } catch (_) {
          if (embedded) {
            try { window.parent.postMessage({ type: 'orthodox-translation-ready' }, '*'); } catch (_) {}
          }
        }
      };

      const script = document.createElement('script');
      script.dataset.dolGoogleTranslate = 'true';
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        translateScriptRequested = false;
        if (embedded) {
          try { window.parent.postMessage({ type: 'orthodox-translation-ready' }, '*'); } catch (_) {}
        }
      };
      document.head.appendChild(script);
    };

    // Dynamic pages such as Prayers, Calendar and the Study Bible can insert
    // content after Google's first pass. Use one debounced refresh, never a
    // MutationObserver or repeated polling loop.
    const refreshTranslation = () => {
      if (!settings.language || settings.language === 'en') return;

      clearTimeout(refreshTranslateTimer);
      refreshTranslateTimer = setTimeout(() => {
        if (!document.querySelector('.goog-te-combo')) {
          loadGoogleTranslate();
          return;
        }
        applyGoogleTranslation(0, true);
      }, 220);
    };

    window.OrthodoxAccessibility = {
      refreshTranslation,
      get language() { return settings.language; }
    };

    // Embedded pages never create another accessibility control.
    if (embedded) {
      document.querySelectorAll('.oa-accessibility').forEach(el => el.remove());

      if (settings.language && settings.language !== 'en') {
        setTimeout(loadGoogleTranslate, 120);
      } else {
        try { window.parent.postMessage({ type: 'orthodox-translation-ready' }, '*'); } catch (_) {}
      }
      return;
    }

    // Guarantee one, and only one, accessibility control on every top-level page.
    document.querySelectorAll('.oa-accessibility').forEach(el => el.remove());

    const setLanguage = language => {
      settings.language = supportedCodes.has(language) ? language : defaultLanguage;
      saveSettings();
      writeTranslateCookie(settings.language);
      window.location.reload();
    };

    const shell = document.createElement('div');
    shell.className = 'oa-accessibility notranslate';
    shell.innerHTML = `
      <button class="oa-accessibility-toggle" type="button" aria-label="Accessibility and language" aria-expanded="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4.5" r="2.2"/><path d="M5 9h14M12 9v5M12 14l-4 6M12 14l4 6"/></svg>
      </button>
      <section class="oa-accessibility-panel" aria-label="Accessibility and language options" hidden>
        <header><strong>Accessibility</strong><button class="oa-accessibility-close" type="button" aria-label="Close accessibility options">×</button></header>
        <div class="oa-a11y-field oa-a11y-language-field">
          <span>Language</span>
          <button class="oa-a11y-language-button" data-a11y-language-button type="button" aria-haspopup="listbox" aria-expanded="false"></button>
          <div class="oa-a11y-language-menu" data-a11y-language-menu role="listbox" hidden>
            ${supportedLanguages.map(([code,name]) => `<button type="button" role="option" data-language-code="${code}">${name}</button>`).join('')}
          </div>
        </div>
        <label class="oa-a11y-field"><span>Text size</span><select data-a11y-font><option value="0.9">90%</option><option value="1">100%</option><option value="1.15">115%</option><option value="1.3">130%</option></select></label>
        <label class="oa-a11y-switch"><span>High contrast</span><input type="checkbox" data-a11y-contrast /></label>
        <label class="oa-a11y-switch"><span>Reduce motion</span><input type="checkbox" data-a11y-motion /></label>
        <label class="oa-a11y-switch"><span>Underline links</span><input type="checkbox" data-a11y-links /></label>
        <button class="oa-a11y-reset" type="button">Reset accessibility</button>
      </section>`;
    document.body.appendChild(shell);

    const toggle = shell.querySelector('.oa-accessibility-toggle');
    const panel = shell.querySelector('.oa-accessibility-panel');
    const close = shell.querySelector('.oa-accessibility-close');
    const languageButton = shell.querySelector('[data-a11y-language-button]');
    const languageMenu = shell.querySelector('[data-a11y-language-menu]');
    const font = shell.querySelector('[data-a11y-font]');
    const contrast = shell.querySelector('[data-a11y-contrast]');
    const motion = shell.querySelector('[data-a11y-motion]');
    const links = shell.querySelector('[data-a11y-links]');
    const reset = shell.querySelector('.oa-a11y-reset');

    const languageName = code => supportedLanguages.find(([value]) => value === code)?.[1] || 'English';
    const syncLanguageUi = () => {
      if (languageButton) languageButton.textContent = languageName(settings.language || defaultLanguage);
      languageMenu?.querySelectorAll('[data-language-code]').forEach(button => {
        const selected = button.dataset.languageCode === (settings.language || defaultLanguage);
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-selected', String(selected));
      });
    };
    syncLanguageUi();
    font.value = String(settings.fontScale || 1);
    contrast.checked = Boolean(settings.contrast);
    motion.checked = Boolean(settings.reduceMotion);
    links.checked = Boolean(settings.underlineLinks);

    const showLanguageMenu = show => {
      if (!languageMenu || !languageButton) return;
      languageMenu.hidden = !show;
      languageButton.setAttribute('aria-expanded', String(show));
      if (show) {
        const selected = languageMenu.querySelector('.is-selected');
        selected?.scrollIntoView({ block: 'nearest' });
      }
    };

    const showPanel = show => {
      panel.hidden = !show;
      toggle.setAttribute('aria-expanded', String(show));
      if (!show) showLanguageMenu(false);
    };

    toggle.addEventListener('click', () => showPanel(panel.hidden));
    close.addEventListener('click', () => showPanel(false));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.hidden) showPanel(false);
    });

    languageButton?.addEventListener('click', event => {
      event.stopPropagation();
      showLanguageMenu(languageMenu?.hidden);
    });
    languageMenu?.querySelectorAll('[data-language-code]').forEach(button => {
      button.addEventListener('click', () => setLanguage(button.dataset.languageCode));
    });
    document.addEventListener('click', event => {
      if (!languageMenu || languageMenu.hidden) return;
      if (!languageMenu.contains(event.target) && !languageButton?.contains(event.target)) showLanguageMenu(false);
    });

    font.addEventListener('change', () => {
      settings.fontScale = Number(font.value);
      saveSettings();
      applySettings();
    });
    contrast.addEventListener('change', () => {
      settings.contrast = contrast.checked;
      saveSettings();
      applySettings();
    });
    motion.addEventListener('change', () => {
      settings.reduceMotion = motion.checked;
      saveSettings();
      applySettings();
    });
    links.addEventListener('change', () => {
      settings.underlineLinks = links.checked;
      saveSettings();
      applySettings();
    });
    reset.addEventListener('click', () => {
      const priorLanguage = settings.language;
      settings = { ...defaults, language: defaultLanguage };
      saveSettings();
      writeTranslateCookie(settings.language);

      if (priorLanguage !== settings.language) {
        window.location.reload();
        return;
      }

      applySettings();
      syncLanguageUi();
      font.value = '1';
      contrast.checked = false;
      motion.checked = false;
      links.checked = false;
    });

    // Start translation only after all first-paint app work is complete.
    // No overlay, no document-wide observer, and no forced retranslations.
    if (settings.language && settings.language !== 'en') {
      setTimeout(loadGoogleTranslate, 160);
    } else {
      writeTranslateCookie('en');
    }

    window.addEventListener('pageshow', () => {
      settings = readSettings();
      applySettings();
      syncLanguageUi();

      // BFCache can restore old DOM, so enforce exactly one control again.
      document.querySelectorAll('.oa-accessibility').forEach((el, index) => {
        if (index > 0) el.remove();
      });

      if (settings.language !== 'en') {
        if (!document.querySelector('.goog-te-combo')) {
          setTimeout(loadGoogleTranslate, 160);
        } else {
          lastAppliedLanguage = '';
          setTimeout(() => applyGoogleTranslation(0, true), 60);
        }
      } else {
        suppressTranslationChrome();
      }
    });
  })();
  (() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const targets = document.querySelectorAll('.oa-section-head, .oa-quick-grid, .oa-card-row, .oa-feature-grid, .oa-calendar-choice-grid, .oa-track-list, .oa-recorded-empty, .liturgical-masthead, body.app-calendar-page .today-section, body.app-calendar-page .right-panel > section');
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
    {title:'Christos Anesti', tradition:'Greek', meta:'Greek Orthodox chant', src:'greek/greek-assets/music/Christos Anesti.mp3'},
    {title:'Come on people', tradition:'Greek', meta:'Greek Orthodox chant', src:'greek/greek-assets/music/Come on people.mp3'},
    {title:'Lament for Constantinople', tradition:'Greek', meta:'Greek Orthodox chant', src:'greek/greek-assets/music/Lament for Constantinople.mp3'},
    {title:'Lord Save Your People', tradition:'Greek', meta:'Greek Orthodox chant', src:'greek/greek-assets/music/Lord Save Your People.mp3'},
    {title:'Praise the Lord from the Heavens', tradition:'Greek', meta:'Greek Orthodox chant', src:'greek/greek-assets/music/Praise the Lord from the Heavens.mp3'},
    {title:'Psalm 49', tradition:'Greek', meta:'Greek Orthodox chant', src:'greek/greek-assets/music/Psalm 49.mp3'},
    {title:'Psalm 50', tradition:'Greek', meta:'Greek Orthodox chant', src:'greek/greek-assets/music/Psalm 50.mp3'},
    {title:'Psalm 90 & 91', tradition:'Greek', meta:'Greek Orthodox chant', src:'greek/greek-assets/music/Psalm 90 & 91.mp3'},
    {title:'Psalm 135', tradition:'Greek', meta:'Greek Orthodox chant', src:'greek/greek-assets/music/Psalm 135.mp3'},
    {title:'Belisarius', tradition:'Russian', meta:'Russian Orthodox chant', src:'russian/russian-assets/music/Belisarius.mp3'},
    {title:'Cherubic Hymn', tradition:'Russian', meta:'Russian Orthodox chant', src:'russian/russian-assets/music/Cherubic Hymn.mp3'},
    {title:'Hymn of the Cherubim', tradition:'Russian', meta:'Russian Orthodox chant', src:'russian/russian-assets/music/Hymn of the Cherubim.mp3'},
    {title:'Lord, I have cried unto Thee', tradition:'Russian', meta:'Russian Orthodox chant', src:'russian/russian-assets/music/Lord, I have cried unto Thee.mp3'},
    {title:'May my prayer be set forth', tradition:'Russian', meta:'Russian Orthodox chant', src:'russian/russian-assets/music/May my prayer be set forth.mp3'},
    {title:'My Sinful Soul', tradition:'Russian', meta:'Russian Orthodox chant', src:'russian/russian-assets/music/My Sinful Soul.mp3'},
    {title:'Open to me the doors of repentance', tradition:'Russian', meta:'Russian Orthodox chant', src:'russian/russian-assets/music/Open to me the doors of repentance.mp3'},
    {title:'That We May Receive the King', tradition:'Russian', meta:'Russian Orthodox chant', src:'russian/russian-assets/music/That We May Receive the King.mp3'},
    {title:'We bow down before Your Cross', tradition:'Russian', meta:'Russian Orthodox chant', src:'russian/russian-assets/music/We bow down before Your Cross.mp3'},
    {title:'We Praise Thee', tradition:'Russian', meta:'Russian Orthodox chant', src:'russian/russian-assets/music/We Praise Thee.mp3'}
  ];

  const iosShufflePlaylists = [{"id":1,"src":"assets/audio-playlists/shuffle-1.m3u8","order":[8,2,18,0,6,7,17,14,19,12,11,9,13,3,16,4,10,5,15,1],"starts":[0.0,742.087,1392.091,1629.336,2044.682,2178.377,2511.752,2841.025,3100.918,3316.924,3769.156,3956.219,4166.766,4409.13,4784.901,5331.122,5400.712,5831.811,6445.166,6910.328],"total":7067.376},{"id":2,"src":"assets/audio-playlists/shuffle-2.m3u8","order":[11,19,9,3,16,15,18,17,10,5,7,0,1,2,4,12,14,13,8,6],"starts":[0.0,187.063,403.069,613.616,989.388,1535.608,2000.771,2238.015,2567.288,2998.387,3611.742,3945.117,4360.464,4517.512,5167.517,5237.107,5689.339,5949.231,6191.595,6933.682],"total":7067.376},{"id":3,"src":"assets/audio-playlists/shuffle-3.m3u8","order":[14,17,5,6,19,1,2,3,10,15,7,8,0,12,18,16,11,13,9,4],"starts":[0.0,259.892,589.166,1202.521,1336.216,1552.222,1709.27,2359.275,2735.047,3166.145,3631.308,3964.682,4706.769,5122.116,5574.348,5811.592,6357.812,6544.875,6787.239,6997.786],"total":7067.376},{"id":4,"src":"assets/audio-playlists/shuffle-4.m3u8","order":[5,7,12,3,6,1,8,17,19,11,4,16,2,13,10,0,18,14,15,9],"starts":[0.0,613.355,946.73,1398.962,1774.733,1908.428,2065.476,2807.562,3136.836,3352.842,3539.905,3609.495,4155.716,4805.721,5048.085,5479.184,5894.531,6131.775,6391.667,6856.829],"total":7067.376},{"id":5,"src":"assets/audio-playlists/shuffle-5.m3u8","order":[4,14,9,16,12,10,18,19,13,11,15,2,0,8,1,7,5,17,3,6],"starts":[0.0,69.59,329.482,540.029,1086.25,1538.482,1969.58,2206.824,2422.831,2665.195,2852.258,3317.42,3967.425,4382.772,5124.859,5281.907,5615.282,6228.637,6557.91,6933.682],"total":7067.376},{"id":6,"src":"assets/audio-playlists/shuffle-6.m3u8","order":[12,14,2,1,10,5,3,11,8,18,6,17,4,16,19,0,15,13,9,7],"starts":[0.0,452.232,712.124,1362.129,1519.177,1950.276,2563.631,2939.402,3126.465,3868.552,4105.796,4239.491,4568.764,4638.354,5184.575,5400.581,5815.928,6281.091,6523.455,6734.002],"total":7067.376}];
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

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

  const STORAGE_KEY = 'orthodoxAudioStateV2';
  const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7.4 17.2 12 9 16.6Z" fill="currentColor" stroke="none"/></svg>';
  const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h3v12H8zM13 6h3v12h-3z" fill="currentColor" stroke="none"/></svg>';
  const previousIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14M18 6l-8 6 8 6z"/></svg>';
  const nextIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 5v14M6 6l8 6-8 6z"/></svg>';
  const stopwatchIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 2h6M12 5v2M17.5 6.5l1.5-1.5M12 7a7 7 0 1 1-7 7 7 7 0 0 1 7-7z"/><path d="M12 10v4l2.5 1.5"/></svg>';
  const minimiseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
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

  audio.classList.add('notranslate');
  audio.setAttribute('translate', 'no');

  let player = document.getElementById('audio-player');
  if (!player) {
    player = document.createElement('div');
    player.id = 'audio-player';
    player.className = 'oa-player oa-global-player notranslate';
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
        <button id="audio-player-minimise" class="oa-player-minimise" type="button" aria-label="Minimise audio player" aria-expanded="true">${minimiseIcon}</button>
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

    let minimise = player.querySelector('#audio-player-minimise');
    if (!minimise) {
      minimise = document.createElement('button');
      minimise.id = 'audio-player-minimise';
      minimise.className = 'oa-player-minimise';
      minimise.type = 'button';
      minimise.setAttribute('aria-label', 'Minimise audio player');
      minimise.setAttribute('aria-expanded', 'true');
      minimise.innerHTML = minimiseIcon;
    }
    tools.appendChild(minimise);

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

  player.classList.add('notranslate');
  player.setAttribute('translate', 'no');

  if (isIOS) player.classList.add('oa-ios-player');

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
    minimise: player.querySelector('#audio-player-minimise'),
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
  let activeShufflePlaylist = null;
  let activeShufflePosition = 0;
  const nativeHlsShuffle = isIOS && Boolean(audio.canPlayType('application/vnd.apple.mpegurl'));

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
      minimized: player.classList.contains('is-minimized'),
      shufflePlaylistId: activeShufflePlaylist?.id || 0,
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

  function playlistTrackAt(time) {
    if (!activeShufflePlaylist) return null;
    const starts = activeShufflePlaylist.starts;
    let position = starts.length - 1;
    for (let i = 0; i < starts.length; i += 1) {
      if (time < starts[i]) {
        position = Math.max(0, i - 1);
        break;
      }
    }
    const trackIndex = activeShufflePlaylist.order[position];
    return { position, trackIndex, start: starts[position] };
  }

  function syncShufflePlaylistMetadata() {
    if (!activeShufflePlaylist) return;
    const current = playlistTrackAt(audio.currentTime || 0);
    if (!current || current.position === activeShufflePosition) return;
    activeShufflePosition = current.position;
    index = current.trackIndex;
    const track = tracks[index];
    if (ui.title) ui.title.textContent = track.title;
    if (ui.meta) ui.meta.textContent = track.meta;
    setMediaSession(track);
    persist(true);
    dispatch();
  }

  function startIOSShuffle(playlistId = 0, seekTo = 0, shouldPlay = true) {
    if (!nativeHlsShuffle || !iosShufflePlaylists.length) return false;

    let playlist = iosShufflePlaylists.find(item => item.id === Number(playlistId));
    if (!playlist) playlist = iosShufflePlaylists[Math.floor(Math.random() * iosShufflePlaylists.length)];

    activeShufflePlaylist = playlist;
    shuffleMode = true;
    activeShufflePosition = 0;
    index = playlist.order[0];

    const firstTrack = tracks[index];
    ui.title.textContent = firstTrack.title;
    ui.meta.textContent = firstTrack.meta;
    setMediaSession(firstTrack);

    audio.src = appUrl(playlist.src);
    audio.preload = 'auto';
    player.hidden = false;
    player.style.removeProperty('display');
    player.classList.add('is-visible');
    player.setAttribute('aria-hidden', 'false');

    const begin = () => {
      const target = Math.max(0, Number(seekTo) || 0);
      try { audio.currentTime = target; } catch (_) {}
      syncShufflePlaylistMetadata();

      if (shouldPlay) {
        desiredPlaying = true;
        audio.play().catch(() => {
          if (ui.play) ui.play.innerHTML = playIcon;
          dispatch();
        });
      } else {
        desiredPlaying = false;
      }

      persist(true);
      dispatch();
    };

    if (audio.readyState >= 1) begin();
    else audio.addEventListener('loadedmetadata', begin, { once: true });
    return true;
  }

  function setTrack(nextIndex, options = {}) {
    activeShufflePlaylist = null;
    activeShufflePosition = 0;
    if (typeof options.shuffle === 'boolean') shuffleMode = options.shuffle;
    index = (nextIndex + tracks.length) % tracks.length;
    const track = tracks[index];
    ui.title.textContent = track.title;
    ui.meta.textContent = track.meta;
    audio.src = appUrl(track.src);
    player.hidden = false;
    player.style.removeProperty('display');
    player.classList.add('is-visible');
    player.setAttribute('aria-hidden', 'false');
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
    if (startIOSShuffle(0, 0, true)) return;
    setTrack(randomIndex(index), { currentTime: 0, play: true, shuffle: true });
  }

  function nextTrack() {
    if (activeShufflePlaylist) {
      const nextPos = (activeShufflePosition + 1) % activeShufflePlaylist.order.length;
      if (nextPos === 0) {
        startIOSShuffle(0, 0, true);
      } else {
        activeShufflePosition = nextPos;
        audio.currentTime = activeShufflePlaylist.starts[nextPos];
        syncShufflePlaylistMetadata();
        audio.play().catch(() => {});
      }
      return;
    }
    if (shuffleMode) startRandom();
    else start(index >= tracks.length - 1 ? 0 : index + 1);
  }

  function previousTrack() {
    if (activeShufflePlaylist) {
      const previousPos = activeShufflePosition <= 0 ? 0 : activeShufflePosition - 1;
      activeShufflePosition = previousPos;
      audio.currentTime = activeShufflePlaylist.starts[previousPos];
      syncShufflePlaylistMetadata();
      audio.play().catch(() => {});
      return;
    }
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

    // iOS Safari/PWAs intentionally reserve media output volume for the
    // hardware/system volume controls. Other browsers use the website slider.
    if (!isIOS && !fadeInterval) audio.volume = userVolume;
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

  function setPlayerMinimized(minimized, shouldPersist = true) {
    const value = Boolean(minimized);
    player.classList.toggle('is-minimized', value);

    if (ui.minimise) {
      ui.minimise.setAttribute('aria-expanded', String(!value));
      ui.minimise.setAttribute('aria-label', value ? 'Expand audio player' : 'Minimise audio player');
      ui.minimise.title = value ? 'Expand player' : 'Minimise player';
    }

    if (value && ui.sleepPanel && !ui.sleepPanel.hidden) {
      ui.sleepPanel.hidden = true;
      ui.timer?.setAttribute('aria-expanded', 'false');
    }

    if (shouldPersist) persist(true);
  }

  function togglePlayerMinimized() {
    setPlayerMinimized(!player.classList.contains('is-minimized'));
  }

  function closePlayer() {
    desiredPlaying = false;
    activeShufflePlaylist = null;
    activeShufflePosition = 0;
    shuffleMode = false;

    clearSleepTimer({ persist: false, restoreVolume: false });

    // Hide first so pause/load events can never leave a tiny shell behind.
    player.classList.remove('is-visible', 'is-minimized');
    player.setAttribute('aria-hidden', 'true');
    player.hidden = true;
    player.style.setProperty('display', 'none', 'important');

    index = -1;
    try { audio.pause(); } catch (_) {}
    try {
      audio.removeAttribute('src');
      audio.load();
    } catch (_) {}

    clearState();
    setTimeout(clearState, 80);
    window.dispatchEvent(new CustomEvent('orthodoxaudiochange', {
      detail: { index: -1, playing: false, desiredPlaying: false }
    }));
  }

  ui.play?.addEventListener('click', toggle);
  ui.prev?.addEventListener('click', previousTrack);
  ui.next?.addEventListener('click', nextTrack);
  ui.minimise?.addEventListener('click', togglePlayerMinimized);
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
    if (activeShufflePlaylist) syncShufflePlaylistMetadata();
    if (sleepTimerEnd && Date.now() >= sleepTimerEnd && !fadeInterval) finishSleepTimer();

    if (ui.scrub) ui.scrub.value = audio.duration ? String((audio.currentTime / audio.duration) * 100) : '0';
    if (ui.current) ui.current.textContent = fmt(audio.currentTime);
    if (ui.duration) ui.duration.textContent = fmt(audio.duration);
    persist();
  });
  audio.addEventListener('durationchange', () => { if (ui.duration) ui.duration.textContent = fmt(audio.duration); });
  audio.addEventListener('play', () => {
    desiredPlaying = true;
    player.hidden = false;
    player.style.removeProperty('display');
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
  audio.addEventListener('ended', () => {
    if (activeShufflePlaylist && shuffleMode) startIOSShuffle(0, 0, true);
    else nextTrack();
  });

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
      persistentFrame.className = 'oa-persistent-frame is-loading';
      persistentFrame.title = 'Daily Orthodox Life';
      persistentFrame.setAttribute('allow', 'autoplay');
      persistentFrame.addEventListener('load', () => {
        persistentFrame?.classList.remove('is-loading');
      });
      document.body.appendChild(persistentFrame);
      document.documentElement.classList.add('oa-persistent-audio-shell');
    }

    if (pushHistory && window.location.href !== target.href) {
      try { history.pushState({ orthodoxPersistentRoute: target.href }, '', target.href); } catch (_) {}
    }
    if (persistentFrame.src !== target.href) {
      persistentFrame.classList.add('is-loading');
      persistentFrame.src = target.href;
      window.clearTimeout(persistentFrame._dolRevealTimer);
      persistentFrame._dolRevealTimer = window.setTimeout(() => persistentFrame?.classList.remove('is-loading'), 6000);
    }
    window.scrollTo(0, 0);
  }

  /* Keep navigation native and reliable on mobile.
     Audio state is persisted immediately before an internal navigation so the
     next page can restore it, without an iframe shell that can freeze or blank. */
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    let target;
    try { target = new URL(href, window.location.href); } catch (_) { return; }
    if (index >= 0 && isInternalAppPage(target)) persist(true);
  }, true);

  window.addEventListener('message', event => {
    const data = event.data || {};

    if (data.type === 'orthodox-translation-ready') {
      persistentFrame?.classList.remove('is-loading');
      return;
    }

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

  if (restored) setPlayerMinimized(Boolean(restored.minimized), false);

  if (restored?.shuffle && restored?.shufflePlaylistId && nativeHlsShuffle) {
    startIOSShuffle(
      Number(restored.shufflePlaylistId),
      Number(restored.currentTime) || 0,
      Boolean(restored.playing)
    );
  } else if (restored && Number.isInteger(restored.index) && restored.index >= 0 && restored.index < tracks.length) {
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
