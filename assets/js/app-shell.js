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

    // Guarantee one, and only one, accessibility control in this document.
    // Framed pages own their own control; the parent copy is hidden while the
    // persistent audio shell is active.
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
    const topbar = document.querySelector('.oa-topbar');
    if (topbar) {
      topbar.appendChild(shell);
    } else {
      const host = document.querySelector('.reader-page, .app-shell, .oa-page, .app-main') || document.body;
      const row = document.createElement('div');
      row.className = 'oa-accessibility-row notranslate';
      row.appendChild(shell);
      if (host === document.body) document.body.prepend(row);
      else host.prepend(row);
    }

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
      if (embedded) {
        try { window.parent.postMessage({ type: 'orthodox-translation-ready' }, '*'); } catch (_) {}
      }
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

  /* Shared audio player. Direct MP3 playback is used while the app is visible
     for instant start and correct track progress. On iOS shuffle, a native HLS
     sequence is used only while the app is backgrounded so the next chant can
     continue when the screen is locked. */
  (() => {
    const tracks = [
    {title:"Agni Parthene", tradition:"Greek", meta:"Greek Orthodox chant", src:"greek/greek-assets/music/Agni Parthene.mp3"},
    {title:"Christos Anesti", tradition:"Greek", meta:"Greek Orthodox chant", src:"greek/greek-assets/music/Christos Anesti.mp3"},
    {title:"Come on people", tradition:"Greek", meta:"Greek Orthodox chant", src:"greek/greek-assets/music/Come on people.mp3"},
    {title:"Lament for Constantinople", tradition:"Greek", meta:"Greek Orthodox chant", src:"greek/greek-assets/music/Lament for Constantinople.mp3"},
    {title:"Lord Save Your People", tradition:"Greek", meta:"Greek Orthodox chant", src:"greek/greek-assets/music/Lord Save Your People.mp3"},
    {title:"Praise the Lord from the Heavens", tradition:"Greek", meta:"Greek Orthodox chant", src:"greek/greek-assets/music/Praise the Lord from the Heavens.mp3"},
    {title:"Psalm 49", tradition:"Greek", meta:"Greek Orthodox chant", src:"greek/greek-assets/music/Psalm 49.mp3"},
    {title:"Psalm 50", tradition:"Greek", meta:"Greek Orthodox chant", src:"greek/greek-assets/music/Psalm 50.mp3"},
    {title:"Psalm 90 & 91", tradition:"Greek", meta:"Greek Orthodox chant", src:"greek/greek-assets/music/Psalm 90 & 91.mp3"},
    {title:"Psalm 135", tradition:"Greek", meta:"Greek Orthodox chant", src:"greek/greek-assets/music/Psalm 135.mp3"},
    {title:"Belisarius", tradition:"Russian", meta:"Russian Orthodox chant", src:"russian/russian-assets/music/Belisarius.mp3"},
    {title:"Cherubic Hymn", tradition:"Russian", meta:"Russian Orthodox chant", src:"russian/russian-assets/music/Cherubic Hymn.mp3"},
    {title:"Hymn of the Cherubim", tradition:"Russian", meta:"Russian Orthodox chant", src:"russian/russian-assets/music/Hymn of the Cherubim.mp3"},
    {title:"Lord, I have cried unto Thee", tradition:"Russian", meta:"Russian Orthodox chant", src:"russian/russian-assets/music/Lord, I have cried unto Thee.mp3"},
    {title:"May my prayer be set forth", tradition:"Russian", meta:"Russian Orthodox chant", src:"russian/russian-assets/music/May my prayer be set forth.mp3"},
    {title:"My Sinful Soul", tradition:"Russian", meta:"Russian Orthodox chant", src:"russian/russian-assets/music/My Sinful Soul.mp3"},
    {title:"Open to me the doors of repentance", tradition:"Russian", meta:"Russian Orthodox chant", src:"russian/russian-assets/music/Open to me the doors of repentance.mp3"},
    {title:"That We May Receive the King", tradition:"Russian", meta:"Russian Orthodox chant", src:"russian/russian-assets/music/That We May Receive the King.mp3"},
    {title:"We bow down before Your Cross", tradition:"Russian", meta:"Russian Orthodox chant", src:"russian/russian-assets/music/We bow down before Your Cross.mp3"},
    {title:"We Praise Thee", tradition:"Russian", meta:"Russian Orthodox chant", src:"russian/russian-assets/music/We Praise Thee.mp3"}
    ];

    const trackDurations = [415.347, 157.048, 650.005, 375.771, 69.59, 613.355, 133.695, 333.375, 742.087, 210.547, 431.099, 187.063, 452.232, 242.364, 259.892, 465.162, 546.22, 329.273, 237.244, 216.007];
    const backgroundPlaylists = [{"first":0,"src":"assets/audio-playlists/background-0.m3u8","order":[0,7,14,19,6,8,15,2,13,3,5,1,4,18,11,12,9,10,17,16],"starts":[0.0,415.347,748.722,1008.614,1224.62,1358.315,2100.402,2565.564,3215.569,3457.933,3833.704,4447.06,4604.108,4673.698,4910.942,5098.005,5550.237,5760.784,6191.882,6521.156],"durations":[415.347,333.375,259.892,216.007,133.695,742.087,465.162,650.005,242.364,375.771,613.355,157.048,69.59,237.244,187.063,452.232,210.547,431.099,329.273,546.22]},{"first":1,"src":"assets/audio-playlists/background-1.m3u8","order":[1,11,6,4,15,18,2,7,16,3,5,17,19,13,14,12,9,10,8,0],"starts":[0.0,157.048,344.111,477.806,547.396,1012.558,1249.802,1899.807,2233.182,2779.402,3155.174,3768.529,4097.802,4313.809,4556.173,4816.065,5268.297,5478.844,5909.943,6652.029],"durations":[157.048,187.063,133.695,69.59,465.162,237.244,650.005,333.375,546.22,375.771,613.355,329.273,216.007,242.364,259.892,452.232,210.547,431.099,742.087,415.347]},{"first":2,"src":"assets/audio-playlists/background-2.m3u8","order":[2,8,11,10,3,4,9,13,19,0,1,14,16,5,12,6,15,18,7,17],"starts":[0.0,650.005,1392.091,1579.154,2010.253,2386.024,2455.615,2666.162,2908.526,3124.532,3539.879,3696.927,3956.82,4503.04,5116.395,5568.627,5702.322,6167.484,6404.728,6738.103],"durations":[650.005,742.087,187.063,431.099,375.771,69.59,210.547,242.364,216.007,415.347,157.048,259.892,546.22,613.355,452.232,133.695,465.162,237.244,333.375,329.273]},{"first":3,"src":"assets/audio-playlists/background-3.m3u8","order":[3,1,4,11,14,17,16,0,12,9,8,18,5,19,7,2,15,10,6,13],"starts":[0.0,375.771,532.82,602.41,789.473,1049.365,1378.638,1924.859,2340.206,2792.438,3002.984,3745.071,3982.315,4595.67,4811.677,5145.051,5795.056,6260.219,6691.318,6825.012],"durations":[375.771,157.048,69.59,187.063,259.892,329.273,546.22,415.347,452.232,210.547,742.087,237.244,613.355,216.007,333.375,650.005,465.162,431.099,133.695,242.364]},{"first":4,"src":"assets/audio-playlists/background-4.m3u8","order":[4,8,1,10,11,17,0,18,7,12,19,13,15,3,14,5,6,9,16,2],"starts":[0.0,69.59,811.677,968.725,1399.824,1586.887,1916.16,2331.507,2568.751,2902.126,3354.358,3570.364,3812.728,4277.891,4653.662,4913.554,5526.909,5660.604,5871.151,6417.371],"durations":[69.59,742.087,157.048,431.099,187.063,329.273,415.347,237.244,333.375,452.232,216.007,242.364,465.162,375.771,259.892,613.355,133.695,210.547,546.22,650.005]},{"first":5,"src":"assets/audio-playlists/background-5.m3u8","order":[5,0,19,13,2,6,14,4,17,18,15,12,9,7,1,10,11,8,3,16],"starts":[0.0,613.355,1028.702,1244.709,1487.073,2137.078,2270.772,2530.664,2600.255,2929.528,3166.772,3631.935,4084.166,4294.713,4628.088,4785.136,5216.235,5403.298,6145.384,6521.156],"durations":[613.355,415.347,216.007,242.364,650.005,133.695,259.892,69.59,329.273,237.244,465.162,452.232,210.547,333.375,157.048,431.099,187.063,742.087,375.771,546.22]},{"first":6,"src":"assets/audio-playlists/background-6.m3u8","order":[6,15,8,1,16,18,7,11,10,12,4,19,14,9,0,5,2,3,17,13],"starts":[0.0,133.695,598.857,1340.944,1497.992,2044.212,2281.456,2614.831,2801.894,3232.993,3685.224,3754.815,3970.821,4230.713,4441.26,4856.607,5469.962,6119.967,6495.739,6825.012],"durations":[133.695,465.162,742.087,157.048,546.22,237.244,333.375,187.063,431.099,452.232,69.59,216.007,259.892,210.547,415.347,613.355,650.005,375.771,329.273,242.364]},{"first":7,"src":"assets/audio-playlists/background-7.m3u8","order":[7,10,16,5,17,3,8,4,12,18,19,1,0,2,9,13,14,15,11,6],"starts":[0.0,333.375,764.473,1310.694,1924.049,2253.322,2629.094,3371.18,3440.771,3893.002,4130.247,4346.253,4503.301,4918.648,5568.653,5779.2,6021.564,6281.456,6746.619,6933.682],"durations":[333.375,431.099,546.22,613.355,329.273,375.771,742.087,69.59,452.232,237.244,216.007,157.048,415.347,650.005,210.547,242.364,259.892,465.162,187.063,133.695]},{"first":8,"src":"assets/audio-playlists/background-8.m3u8","order":[8,10,4,5,13,9,15,7,0,2,12,3,6,14,16,18,17,11,1,19],"starts":[0.0,742.087,1173.185,1242.776,1856.131,2098.495,2309.042,2774.204,3107.579,3522.926,4172.931,4625.162,5000.934,5134.629,5394.521,5940.741,6177.985,6507.259,6694.322,6851.37],"durations":[742.087,431.099,69.59,613.355,242.364,210.547,465.162,333.375,415.347,650.005,452.232,375.771,133.695,259.892,546.22,237.244,329.273,187.063,157.048,216.007]},{"first":9,"src":"assets/audio-playlists/background-9.m3u8","order":[9,11,14,17,2,1,15,16,12,8,13,10,4,3,18,6,19,7,5,0],"starts":[0.0,210.547,397.61,657.502,986.776,1636.78,1793.829,2258.991,2805.211,3257.443,3999.53,4241.894,4672.993,4742.583,5118.354,5355.598,5489.293,5705.3,6038.674,6652.029],"durations":[210.547,187.063,259.892,329.273,650.005,157.048,465.162,546.22,452.232,742.087,242.364,431.099,69.59,375.771,237.244,133.695,216.007,333.375,613.355,415.347]},{"first":10,"src":"assets/audio-playlists/background-10.m3u8","order":[10,7,18,15,6,17,4,19,11,14,16,2,1,0,5,9,13,12,3,8],"starts":[0.0,431.099,764.473,1001.718,1466.88,1600.575,1929.848,1999.438,2215.445,2402.508,2662.4,3208.62,3858.625,4015.673,4431.02,5044.375,5254.922,5497.286,5949.518,6325.29],"durations":[431.099,333.375,237.244,465.162,133.695,329.273,69.59,216.007,187.063,259.892,546.22,650.005,157.048,415.347,613.355,210.547,242.364,452.232,375.771,742.087]},{"first":11,"src":"assets/audio-playlists/background-11.m3u8","order":[11,13,9,0,10,15,17,1,6,7,5,2,3,19,8,18,12,4,16,14],"starts":[0.0,187.063,429.427,639.974,1055.321,1486.42,1951.582,2280.855,2437.904,2571.598,2904.973,3518.328,4168.333,4544.104,4760.111,5502.198,5739.442,6191.673,6261.264,6807.484],"durations":[187.063,242.364,210.547,415.347,431.099,465.162,329.273,157.048,133.695,333.375,613.355,650.005,375.771,216.007,742.087,237.244,452.232,69.59,546.22,259.892]},{"first":12,"src":"assets/audio-playlists/background-12.m3u8","order":[12,11,10,8,13,17,19,2,7,14,9,1,6,3,5,18,15,16,4,0],"starts":[0.0,452.232,639.295,1070.393,1812.48,2054.844,2384.118,2600.124,3250.129,3583.504,3843.396,4053.943,4210.991,4344.686,4720.457,5333.812,5571.056,6036.219,6582.439,6652.029],"durations":[452.232,187.063,431.099,742.087,242.364,329.273,216.007,650.005,333.375,259.892,210.547,157.048,133.695,375.771,613.355,237.244,465.162,546.22,69.59,415.347]},{"first":13,"src":"assets/audio-playlists/background-13.m3u8","order":[13,12,14,5,8,7,11,0,1,10,6,2,18,9,17,19,15,4,16,3],"starts":[0.0,242.364,694.596,954.488,1567.843,2309.93,2643.304,2830.367,3245.714,3402.762,3833.861,3967.556,4617.561,4854.805,5065.352,5394.625,5610.632,6075.794,6145.384,6691.605],"durations":[242.364,452.232,259.892,613.355,742.087,333.375,187.063,415.347,157.048,431.099,133.695,650.005,237.244,210.547,329.273,216.007,465.162,69.59,546.22,375.771]},{"first":14,"src":"assets/audio-playlists/background-14.m3u8","order":[14,2,17,10,0,5,7,15,3,9,4,12,6,13,8,16,11,19,18,1],"starts":[0.0,259.892,909.897,1239.171,1670.269,2085.616,2698.971,3032.346,3497.509,3873.28,4083.827,4153.417,4605.649,4739.344,4981.708,5723.794,6270.015,6457.078,6673.084,6910.328],"durations":[259.892,650.005,329.273,431.099,415.347,613.355,333.375,465.162,375.771,210.547,69.59,452.232,133.695,242.364,742.087,546.22,187.063,216.007,237.244,157.048]},{"first":15,"src":"assets/audio-playlists/background-15.m3u8","order":[15,17,18,10,0,1,13,19,4,12,8,16,14,9,11,5,2,6,7,3],"starts":[0.0,465.162,794.436,1031.68,1462.779,1878.126,2035.174,2277.538,2493.544,2563.135,3015.366,3757.453,4303.673,4563.566,4774.113,4961.175,5574.531,6224.535,6358.23,6691.605],"durations":[465.162,329.273,237.244,431.099,415.347,157.048,242.364,216.007,69.59,452.232,742.087,546.22,259.892,210.547,187.063,613.355,650.005,133.695,333.375,375.771]},{"first":16,"src":"assets/audio-playlists/background-16.m3u8","order":[16,11,8,9,19,14,4,10,0,5,3,1,18,6,13,7,15,12,2,17],"starts":[0.0,546.22,733.283,1475.37,1685.917,1901.923,2161.816,2231.406,2662.504,3077.851,3691.207,4066.978,4224.026,4461.27,4594.965,4837.329,5170.704,5635.866,6088.098,6738.103],"durations":[546.22,187.063,742.087,210.547,216.007,259.892,69.59,431.099,415.347,613.355,375.771,157.048,237.244,133.695,242.364,333.375,465.162,452.232,650.005,329.273]},{"first":17,"src":"assets/audio-playlists/background-17.m3u8","order":[17,2,12,13,5,18,15,10,8,4,9,16,3,0,6,7,19,11,14,1],"starts":[0.0,329.273,979.278,1431.51,1673.874,2287.229,2524.473,2989.636,3420.735,4162.821,4232.411,4442.958,4989.179,5364.95,5780.297,5913.992,6247.366,6463.373,6650.436,6910.328],"durations":[329.273,650.005,452.232,242.364,613.355,237.244,465.162,431.099,742.087,69.59,210.547,546.22,375.771,415.347,133.695,333.375,216.007,187.063,259.892,157.048]},{"first":18,"src":"assets/audio-playlists/background-18.m3u8","order":[18,6,3,1,0,7,11,5,8,9,12,14,10,4,2,16,15,13,17,19],"starts":[0.0,237.244,370.939,746.71,903.758,1319.105,1652.48,1839.543,2452.898,3194.984,3405.531,3857.763,4117.655,4548.754,4618.344,5268.349,5814.57,6279.732,6522.096,6851.37],"durations":[237.244,133.695,375.771,157.048,415.347,333.375,187.063,613.355,742.087,210.547,452.232,259.892,431.099,69.59,650.005,546.22,465.162,242.364,329.273,216.007]},{"first":19,"src":"assets/audio-playlists/background-19.m3u8","order":[19,8,5,1,7,13,3,15,10,18,9,6,4,17,11,14,12,16,2,0],"starts":[0.0,216.007,958.093,1571.448,1728.496,2061.871,2304.235,2680.007,3145.169,3576.268,3813.512,4024.059,4157.753,4227.344,4556.617,4743.68,5003.572,5455.804,6002.024,6652.029],"durations":[216.007,742.087,613.355,157.048,333.375,242.364,375.771,465.162,431.099,237.244,210.547,133.695,69.59,329.273,187.063,259.892,452.232,546.22,650.005,415.347]}];
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const embedded = window.self !== window.top;

    if (embedded) {
      document.querySelectorAll('#audio, #audio-player').forEach(el => el.remove());

      const proxyState = { index: -1, playing: false };
      const send = (command, value) => {
        try { window.parent.postMessage({ type:'orthodox-audio-command', command, value }, '*'); } catch (_) {}
      };

      window.OrthodoxAudio = {
        tracks,
        start(i) { send('start', Number(i)); },
        shuffle() { send('shuffle'); },
        toggle() { send('toggle'); },
        close() { send('close'); },
        get currentIndex() { return proxyState.index; },
        get isPlaying() { return proxyState.playing; },
        get audio() { return null; }
      };

      window.addEventListener('message', event => {
        const data = event.data || {};
        if (data.type !== 'orthodox-audio-state') return;
        proxyState.index = Number.isInteger(data.index) ? data.index : -1;
        proxyState.playing = Boolean(data.playing);
        window.dispatchEvent(new CustomEvent('orthodoxaudiochange', {
          detail: { index: proxyState.index, playing: proxyState.playing }
        }));
      });

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
        try { window.parent.postMessage({ type:'orthodox-route', href:target.href }, '*'); } catch (_) {}
      }, true);

      try { window.parent.postMessage({ type:'orthodox-audio-child-ready' }, '*'); } catch (_) {}
      return;
    }

    const STORAGE_KEY = 'orthodoxAudioStateV3';
    const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7.4 17.2 12 9 16.6Z" fill="currentColor" stroke="none"/></svg>';
    const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h3v12H8zM13 6h3v12h-3z" fill="currentColor" stroke="none"/></svg>';
    const previousIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14M18 6l-8 6 8 6z"/></svg>';
    const nextIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 5v14M6 6l8 6-8 6z"/></svg>';
    const stopwatchIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 2h6M12 5v2M17.5 6.5l1.5-1.5M12 7a7 7 0 1 1-7 7 7 7 0 0 1 7-7z"/><path d="M12 10v4l2.5 1.5"/></svg>';
    const minimiseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

    const fmt = seconds => {
      if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
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
    audio.setAttribute('translate','no');

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
    }

    if (isIOS) player.classList.add('oa-ios-player');

    const ui = {
      title: player.querySelector('#audio-player-title'),
      meta: player.querySelector('#audio-player-meta'),
      play: player.querySelector('#audio-player-play'),
      prev: player.querySelector('#audio-player-prev'),
      next: player.querySelector('#audio-player-next'),
      volume: player.querySelector('#audio-volume'),
      volumeDown: player.querySelector('#audio-volume-down'),
      volumeUp: player.querySelector('#audio-volume-up'),
      timer: player.querySelector('#audio-sleep-timer'),
      timerBadge: player.querySelector('#audio-sleep-timer-badge'),
      minimise: player.querySelector('#audio-player-minimise'),
      close: player.querySelector('#audio-player-close'),
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
    let userVolume = 1;
    let sleepTimerEnd = 0;
    let sleepTimeout = null;
    let sleepTicker = null;
    let fadeInterval = null;
    let fadeStopTimeout = null;
    let audioContext = null;
    let mediaSourceNode = null;
    let fadeGainNode = null;
    let persistentFrame = null;
    let backgroundPlaylist = null;
    let backgroundPosition = 0;
    let backgroundSwitching = false;
    let lastPersistAt = 0;

    const readState = () => {
      try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); }
      catch (_) { return null; }
    };

    const clearState = () => {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
    };

    function backgroundTrackInfo(time = audio.currentTime) {
      if (!backgroundPlaylist) return null;
      const starts = backgroundPlaylist.starts;
      let pos = starts.length - 1;
      for (let i = 1; i < starts.length; i += 1) {
        if (time < starts[i]) { pos = i - 1; break; }
      }
      const trackIndex = backgroundPlaylist.order[pos];
      return {
        pos,
        trackIndex,
        offset: Math.max(0, time - starts[pos]),
        duration: backgroundPlaylist.durations[pos]
      };
    }

    function effectivePosition() {
      const bg = backgroundTrackInfo();
      if (bg) return { index:bg.trackIndex, currentTime:bg.offset };
      return { index, currentTime:Number.isFinite(audio.currentTime) ? audio.currentTime : 0 };
    }

    function persist(force = false) {
      if (index < 0) return;
      const now = Date.now();
      if (!force && now - lastPersistAt < 750) return;
      lastPersistAt = now;
      const pos = effectivePosition();
      const state = {
        index: pos.index,
        currentTime: pos.currentTime,
        playing: desiredPlaying,
        shuffle: shuffleMode,
        minimized: player.classList.contains('is-minimized'),
        volume: userVolume,
        sleepTimerEnd,
        updatedAt: now
      };
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    }

    function sendStateToFrame() {
      if (!persistentFrame?.contentWindow) return;
      try { persistentFrame.contentWindow.postMessage({
        type:'orthodox-audio-state',
        index,
        playing:!audio.paused
      }, '*'); } catch (_) {}
    }

    function dispatch() {
      const detail = { index, playing:!audio.paused, desiredPlaying };
      window.dispatchEvent(new CustomEvent('orthodoxaudiochange', { detail }));
      sendStateToFrame();
    }

    function setMediaSession(track) {
      if (!('mediaSession' in navigator) || !track) return;
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title:track.title,
          artist:track.meta,
          album:'Daily Orthodox Life'
        });
      } catch (_) {}
    }

    function updateMediaSessionPosition(trackIndex = index, position = null) {
      if (!('mediaSession' in navigator) || typeof navigator.mediaSession.setPositionState !== 'function') return;
      if (!Number.isInteger(trackIndex) || trackIndex < 0 || trackIndex >= trackDurations.length) return;

      const duration = Number(trackDurations[trackIndex]);
      if (!Number.isFinite(duration) || duration <= 0) return;

      let current = Number(position);
      if (!Number.isFinite(current)) {
        if (backgroundPlaylist) {
          const info = backgroundTrackInfo();
          current = info ? info.offset : 0;
        } else {
          current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        }
      }

      current = Math.max(0, Math.min(current, Math.max(0, duration - 0.05)));

      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: Number.isFinite(audio.playbackRate) && audio.playbackRate > 0 ? audio.playbackRate : 1,
          position: current
        });
      } catch (_) {}
    }

    function updateTrackUi(trackIndex) {
      index = trackIndex;
      const track = tracks[index];
      if (!track) return;
      ui.title.textContent = track.title;
      ui.meta.textContent = track.meta;
      setMediaSession(track);
      updateMediaSessionPosition(trackIndex, 0);
      dispatch();
    }

    function showPlayer() {
      player.hidden = false;
      player.style.removeProperty('display');
      player.classList.add('is-visible');
      player.setAttribute('aria-hidden','false');
    }

    function setTrack(nextIndex, options = {}) {
      backgroundPlaylist = null;
      backgroundPosition = 0;
      backgroundSwitching = false;
      if (typeof options.shuffle === 'boolean') shuffleMode = options.shuffle;

      index = (Number(nextIndex) + tracks.length) % tracks.length;
      const track = tracks[index];
      resetFadeGain();
      updateTrackUi(index);
      showPlayer();

      const seekTo = Math.max(0, Number(options.currentTime) || 0);
      audio.preload = 'auto';
      audio.src = appUrl(track.src);
      audio.load();

      const begin = () => {
        if (seekTo > 0) {
          const max = Number.isFinite(audio.duration) && audio.duration > .3 ? audio.duration - .25 : seekTo;
          try { audio.currentTime = Math.min(seekTo, Math.max(0,max)); } catch (_) {}
        }

        if (options.play) {
          desiredPlaying = true;
          audio.play().catch(() => {
            desiredPlaying = false;
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

      // Starting a fresh track should be immediate; don't wait for metadata.
      if (seekTo === 0) begin();
      else if (audio.readyState >= 1) begin();
      else audio.addEventListener('loadedmetadata', begin, { once:true });
    }

    function randomIndex(exclude = -1) {
      if (tracks.length <= 1) return 0;
      let next = Math.floor(Math.random() * tracks.length);
      while (next === exclude) next = Math.floor(Math.random() * tracks.length);
      return next;
    }

    function start(i) { setTrack(i, { currentTime:0, play:true, shuffle:false }); }
    function startRandom() { setTrack(randomIndex(index), { currentTime:0, play:true, shuffle:true }); }

    function nextTrack() {
      if (backgroundPlaylist) return;
      if (shuffleMode) startRandom();
      else start(index >= tracks.length - 1 ? 0 : index + 1);
    }

    function previousTrack() {
      if (backgroundPlaylist) return;
      if (shuffleMode) startRandom();
      else start(index <= 0 ? tracks.length - 1 : index - 1);
    }

    function toggle() {
      if (index < 0) { startRandom(); return; }
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
      userVolume = Number.isFinite(next) ? Math.max(0, Math.min(1,next)) : 1;
      if (!isIOS && !fadeInterval) audio.volume = userVolume;
      if (ui.volume) ui.volume.value = String(userVolume);
      if (shouldPersist) persist(true);
    }
    function changeVolume(delta) {
      setUserVolume(Math.round((userVolume + delta) * 20) / 20);
    }

    function ensureFadeAudioGraph() {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;

      try {
        if (!audioContext) {
          audioContext = new AudioCtx();
          mediaSourceNode = audioContext.createMediaElementSource(audio);
          fadeGainNode = audioContext.createGain();
          fadeGainNode.gain.value = 1;
          mediaSourceNode.connect(fadeGainNode);
          fadeGainNode.connect(audioContext.destination);
        }

        if (audioContext.state === 'suspended') {
          audioContext.resume().catch(() => {});
        }
        return Boolean(fadeGainNode);
      } catch (_) {
        return false;
      }
    }

    function resetFadeGain() {
      if (!fadeGainNode || !audioContext) return;
      try {
        const now = audioContext.currentTime;
        fadeGainNode.gain.cancelScheduledValues(now);
        fadeGainNode.gain.setValueAtTime(1, now);
      } catch (_) {}
    }

    function formatRemaining(ms) {
      const mins = Math.max(1, Math.ceil(ms / 60000));
      if (mins >= 60) {
        const h = Math.floor(mins / 60), m = mins % 60;
        return m ? `${h}h ${m}m` : `${h}h`;
      }
      return `${mins}m`;
    }

    function updateSleepUi() {
      const remaining = sleepTimerEnd - Date.now();
      const active = remaining > 0;
      ui.timer?.classList.toggle('is-active', active);
      if (ui.timer) ui.timer.setAttribute('aria-label', active ? `Sleep timer set, ${formatRemaining(remaining)} remaining` : 'Set sleep timer');
      if (ui.timerBadge) ui.timerBadge.textContent = active ? formatRemaining(remaining) : '';
      if (ui.sleepCancel) ui.sleepCancel.hidden = !active;
    }

    function clearSleepTimer({persistState=true, restoreVolume=true} = {}) {
      clearTimeout(sleepTimeout);
      clearInterval(sleepTicker);
      clearInterval(fadeInterval);
      clearTimeout(fadeStopTimeout);
      sleepTimeout = sleepTicker = fadeInterval = fadeStopTimeout = null;
      sleepTimerEnd = 0;
      resetFadeGain();
      if (restoreVolume && !isIOS) audio.volume = userVolume;
      updateSleepUi();
      if (persistState) persist(true);
    }

    function finishSleepTimer() {
      clearTimeout(sleepTimeout);
      clearInterval(sleepTicker);
      clearInterval(fadeInterval);
      clearTimeout(fadeStopTimeout);
      sleepTimeout = sleepTicker = fadeInterval = fadeStopTimeout = null;

      const fadeMs = 30000;
      const hasGain = ensureFadeAudioGraph();

      if (hasGain && audioContext && fadeGainNode) {
        try {
          const now = audioContext.currentTime;
          fadeGainNode.gain.cancelScheduledValues(now);
          fadeGainNode.gain.setValueAtTime(Math.max(0.0001, fadeGainNode.gain.value || 1), now);
          fadeGainNode.gain.linearRampToValueAtTime(0.0001, now + (fadeMs / 1000));
        } catch (_) {}
      } else {
        const started = performance.now();
        const startVolume = audio.volume;
        fadeInterval = setInterval(() => {
          const p = Math.min(1, (performance.now() - started) / fadeMs);
          const eased = p * p * (3 - 2 * p);
          try { audio.volume = startVolume * Math.max(0, 1 - eased); } catch (_) {}
        }, 200);
      }

      fadeStopTimeout = setTimeout(() => {
        fadeStopTimeout = null;
        closePlayer();
      }, fadeMs + 350);
    }

    function armSleepTimer(endTime) {
      clearSleepTimer({persistState:false});
      sleepTimerEnd = Number(endTime) || 0;
      const remaining = sleepTimerEnd - Date.now();
      if (remaining <= 0) { sleepTimerEnd = 0; updateSleepUi(); return; }
      sleepTimeout = setTimeout(finishSleepTimer, remaining);
      sleepTicker = setInterval(updateSleepUi, 15000);
      updateSleepUi();
      persist(true);
    }

    function setSleepMinutes(minutes) {
      const mins = Math.max(1, Math.min(480, Math.round(Number(minutes) || 0)));
      if (!mins) return;
      ensureFadeAudioGraph();
      resetFadeGain();
      armSleepTimer(Date.now() + mins * 60000);
      if (ui.sleepPanel) ui.sleepPanel.hidden = true;
      ui.timer?.setAttribute('aria-expanded','false');
    }

    function setMinimized(value, persistState=true) {
      const minimized = Boolean(value);
      player.classList.toggle('is-minimized', minimized);
      if (ui.minimise) {
        ui.minimise.setAttribute('aria-expanded', String(!minimized));
        ui.minimise.setAttribute('aria-label', minimized ? 'Expand audio player' : 'Minimise audio player');
      }
      if (minimized && ui.sleepPanel && !ui.sleepPanel.hidden) {
        ui.sleepPanel.hidden = true;
        ui.timer?.setAttribute('aria-expanded','false');
      }
      if (persistState) persist(true);
    }

    function closePlayer() {
      desiredPlaying = false;
      shuffleMode = false;
      backgroundPlaylist = null;
      backgroundPosition = 0;
      backgroundSwitching = false;
      clearSleepTimer({persistState:false, restoreVolume:false});

      player.classList.remove('is-visible','is-minimized');
      player.setAttribute('aria-hidden','true');
      player.hidden = true;
      player.style.setProperty('display','none','important');
      index = -1;

      try { audio.pause(); } catch (_) {}
      try { audio.removeAttribute('src'); audio.load(); } catch (_) {}
      clearState();
      dispatch();

      if (persistentFrame) {
        const target = window.location.href;
        setTimeout(() => window.location.replace(target), 30);
      }
    }

    function playlistForTrack(trackIndex) {
      return backgroundPlaylists.find(p => p.first === trackIndex) || null;
    }

    function enterBackgroundShuffle() {
      if (!isIOS || !shuffleMode || index < 0 || audio.paused || backgroundPlaylist || backgroundSwitching) return;
      if (!audio.canPlayType('application/vnd.apple.mpegurl')) return;

      const playlist = playlistForTrack(index);
      if (!playlist) return;

      backgroundSwitching = true;
      const offset = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      const wasPlaying = desiredPlaying;
      backgroundPlaylist = playlist;
      backgroundPosition = 0;

      audio.src = appUrl(playlist.src);
      audio.load();

      const begin = () => {
        try { audio.currentTime = Math.max(0, offset); } catch (_) {}
        backgroundSwitching = false;
        updateMediaSessionPosition(index, offset);
        if (wasPlaying) audio.play().catch(() => {});
      };
      if (audio.readyState >= 1) begin();
      else audio.addEventListener('loadedmetadata', begin, {once:true});
    }

    function leaveBackgroundShuffle() {
      if (!backgroundPlaylist || backgroundSwitching) return;
      const info = backgroundTrackInfo();
      if (!info) return;

      const wasPlaying = desiredPlaying;
      const minimized = player.classList.contains('is-minimized');
      backgroundPlaylist = null;
      backgroundPosition = 0;
      setTrack(info.trackIndex, {
        currentTime:info.offset,
        play:wasPlaying,
        shuffle:true
      });
      setMinimized(minimized, false);
    }

    function updateBackgroundTrack() {
      if (!backgroundPlaylist) return;
      const info = backgroundTrackInfo();
      if (!info) return;
      if (info.pos !== backgroundPosition || info.trackIndex !== index) {
        backgroundPosition = info.pos;
        updateTrackUi(info.trackIndex);
      }
    }

    ui.play?.addEventListener('click', toggle);
    ui.prev?.addEventListener('click', previousTrack);
    ui.next?.addEventListener('click', nextTrack);
    ui.minimise?.addEventListener('click', () => setMinimized(!player.classList.contains('is-minimized')));
    ui.close?.addEventListener('click', closePlayer);
    ui.volume?.addEventListener('input', () => setUserVolume(ui.volume.value));
    ui.volumeDown?.addEventListener('click', () => changeVolume(-.1));
    ui.volumeUp?.addEventListener('click', () => changeVolume(.1));

    ui.timer?.addEventListener('click', event => {
      event.stopPropagation();
      const opening = ui.sleepPanel?.hidden;
      if (ui.sleepPanel) ui.sleepPanel.hidden = !opening;
      ui.timer?.setAttribute('aria-expanded', String(opening));
      if (opening) updateSleepUi();
    });
    player.querySelectorAll('[data-sleep-minutes]').forEach(button => {
      button.addEventListener('click', () => setSleepMinutes(button.dataset.sleepMinutes));
    });
    ui.sleepCustomSet?.addEventListener('click', () => {
      const value = Number(ui.sleepCustom?.value);
      if (value >= 1) {
        setSleepMinutes(value);
        if (ui.sleepCustom) ui.sleepCustom.value = '';
      } else ui.sleepCustom?.focus();
    });
    ui.sleepCustom?.addEventListener('keydown', e => {
      if (e.key === 'Enter') ui.sleepCustomSet?.click();
    });
    ui.sleepCancel?.addEventListener('click', () => {
      clearSleepTimer();
      if (ui.sleepPanel) ui.sleepPanel.hidden = true;
      ui.timer?.setAttribute('aria-expanded','false');
    });

    document.addEventListener('click', event => {
      if (!ui.sleepPanel || ui.sleepPanel.hidden) return;
      if (ui.sleepPanel.contains(event.target) || ui.timer?.contains(event.target)) return;
      ui.sleepPanel.hidden = true;
      ui.timer?.setAttribute('aria-expanded','false');
    });

    ui.scrub?.addEventListener('input', () => {
      const pct = Math.max(0, Math.min(100, Number(ui.scrub.value) || 0)) / 100;
      if (backgroundPlaylist) {
        const info = backgroundTrackInfo();
        if (info) audio.currentTime = backgroundPlaylist.starts[info.pos] + pct * info.duration;
      } else if (audio.duration) {
        audio.currentTime = pct * audio.duration;
      }
      persist(true);
    });

    audio.addEventListener('timeupdate', () => {
      if (backgroundPlaylist) {
        updateBackgroundTrack();
        const info = backgroundTrackInfo();
        if (info) {
          const pct = info.duration ? (info.offset / info.duration) * 100 : 0;
          if (ui.scrub) ui.scrub.value = String(Math.max(0,Math.min(100,pct)));
          if (ui.current) ui.current.textContent = fmt(info.offset);
          if (ui.duration) ui.duration.textContent = fmt(info.duration);
          updateMediaSessionPosition(info.trackIndex, info.offset);
        }
      } else {
        if (ui.scrub) ui.scrub.value = audio.duration ? String((audio.currentTime / audio.duration) * 100) : '0';
        if (ui.current) ui.current.textContent = fmt(audio.currentTime);
        const d = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : trackDurations[index];
        if (ui.duration) ui.duration.textContent = fmt(d);
        updateMediaSessionPosition(index, audio.currentTime);
      }

      if (sleepTimerEnd && Date.now() >= sleepTimerEnd && !fadeInterval) finishSleepTimer();
      persist();
    });

    audio.addEventListener('durationchange', () => {
      if (backgroundPlaylist) return;
      const d = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : trackDurations[index];
      if (ui.duration) ui.duration.textContent = fmt(d);
    });

    audio.addEventListener('play', () => {
      desiredPlaying = true;
      showPlayer();
      ui.play.innerHTML = pauseIcon;
      persist(true);
      dispatch();
    });
    audio.addEventListener('pause', () => {
      if (!leaving && !backgroundSwitching) desiredPlaying = false;
      ui.play.innerHTML = playIcon;
      persist(true);
      dispatch();
    });
    audio.addEventListener('ended', () => {
      if (backgroundPlaylist && shuffleMode) {
        // Native playlist normally only ends after all tracks. Start a fresh
        // direct random track if the app is visible again.
        if (!document.hidden) startRandom();
      } else nextTrack();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) enterBackgroundShuffle();
      else leaveBackgroundShuffle();
    });

    function isInternalAppPage(target) {
      const sameApp = target.protocol === 'file:'
        ? target.pathname.startsWith(appBaseUrl.pathname)
        : target.origin === appBaseUrl.origin;
      const navigable = /\.html$/i.test(target.pathname) || target.pathname.endsWith('/');
      return sameApp && navigable;
    }

    function openPersistentRoute(href, pushHistory=true) {
      let target;
      try { target = new URL(href, window.location.href); } catch (_) { return; }
      if (!isInternalAppPage(target)) { window.location.href = target.href; return; }

      if (!persistentFrame) {
        persistentFrame = document.createElement('iframe');
        persistentFrame.className = 'oa-persistent-frame';
        persistentFrame.title = 'Daily Orthodox Life';
        persistentFrame.setAttribute('allow','autoplay');
        document.body.appendChild(persistentFrame);
        document.documentElement.classList.add('oa-persistent-audio-shell');
      }

      if (pushHistory && window.location.href !== target.href) {
        try { history.pushState({orthodoxPersistentRoute:target.href}, '', target.href); } catch (_) {}
      }
      if (persistentFrame.src !== target.href) persistentFrame.src = target.href;
      window.scrollTo(0,0);
    }

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
      if (data.command === 'start' && Number.isFinite(Number(data.value))) start(Number(data.value));
      else if (data.command === 'shuffle') startRandom();
      else if (data.command === 'toggle') toggle();
      else if (data.command === 'close') closePlayer();
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
        navigator.mediaSession.setActionHandler('play', () => { desiredPlaying=true; audio.play().catch(()=>{}); });
        navigator.mediaSession.setActionHandler('pause', () => { desiredPlaying=false; audio.pause(); });
        navigator.mediaSession.setActionHandler('previoustrack', previousTrack);
        navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
      } catch (_) {}
    }

    const restored = readState();
    if (restored && Number.isFinite(Number(restored.volume))) setUserVolume(Number(restored.volume), false);
    else setUserVolume(1, false);

    if (restored?.sleepTimerEnd && Number(restored.sleepTimerEnd) > Date.now()) armSleepTimer(Number(restored.sleepTimerEnd));
    else updateSleepUi();

    if (restored) setMinimized(Boolean(restored.minimized), false);

    if (restored && Number.isInteger(restored.index) && restored.index >= 0 && restored.index < tracks.length) {
      setTrack(restored.index, {
        currentTime:Number(restored.currentTime) || 0,
        play:Boolean(restored.playing),
        shuffle:Boolean(restored.shuffle)
      });
    }

    window.OrthodoxAudio = {
      tracks,
      start,
      shuffle:startRandom,
      toggle,
      close:closePlayer,
      get currentIndex() { return index; },
      get audio() { return audio; },
      get isPlaying() { return !audio.paused; }
    };
  })();

})();
