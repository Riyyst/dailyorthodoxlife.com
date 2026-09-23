(() => {
  const data = window.ORTHODOX_DAILY_PRAYERS || [];
  const grid = document.getElementById('prayer-grid');
  const search = document.getElementById('prayer-search');
  const chips = document.getElementById('prayer-filters');
  const modal = document.getElementById('prayer-modal');
  const modalTitle = document.getElementById('prayer-modal-title');
  const modalCategory = document.getElementById('prayer-modal-category');
  const modalText = document.getElementById('prayer-modal-text');
  const FAVOURITES_KEY = 'dailyOrthodoxLifePrayerFavouritesV1';
  let activeFilter = new URLSearchParams(window.location.search).get('category') || 'All';

  const flat = data.flatMap((cat, ci) => (cat.prayers || []).map((p, pi) => ({
    ...p,
    category: cat.category,
    id: `${ci}-${pi}`
  })));

  const favouriteKey = prayer => `${prayer.category}::${prayer.title}`;
  const readFavourites = () => {
    try {
      const value = JSON.parse(localStorage.getItem(FAVOURITES_KEY) || '[]');
      return new Set(Array.isArray(value) ? value.map(String) : []);
    } catch (_) {
      return new Set();
    }
  };
  let favourites = readFavourites();

  const saveFavourites = () => {
    try { localStorage.setItem(FAVOURITES_KEY, JSON.stringify(Array.from(favourites))); } catch (_) {}
  };

  const isFavourite = prayer => favourites.has(favouriteKey(prayer));

  function toggleFavourite(prayer) {
    if (!prayer) return;
    const key = favouriteKey(prayer);
    if (favourites.has(key)) favourites.delete(key);
    else favourites.add(key);
    saveFavourites();
    renderChips();
    render();
  }

  function openPrayer(prayer) {
    if (!prayer) return;
    modalTitle.textContent = prayer.title;
    modalCategory.textContent = prayer.category;
    modalText.textContent = prayer.text;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    modal.querySelector('.oa-modal-panel')?.scrollTo({ top: 0, behavior: 'auto' });
    document.body.style.overflow = 'hidden';
    document.getElementById('prayer-modal-close').focus();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function renderChips() {
    const categories = ['All', 'Favourites', ...data.map(x => x.category)];
    if (!categories.includes(activeFilter)) activeFilter = 'All';
    chips.innerHTML = categories.map(c => `
      <button class="oa-filter-chip ${c === activeFilter ? 'is-active' : ''}" data-filter="${escapeHtml(c)}" type="button">
        ${escapeHtml(c)}${c === 'Favourites' && favourites.size ? ` <span class="oa-favourite-count">${favourites.size}</span>` : ''}
      </button>`).join('');

    chips.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      renderChips();
      render();
    }));
  }

  function render() {
    const q = (search.value || '').trim().toLowerCase();
    const items = flat.filter(p => {
      if (activeFilter === 'Favourites' && !isFavourite(p)) return false;
      if (activeFilter !== 'All' && activeFilter !== 'Favourites' && p.category !== activeFilter) return false;
      return !q || `${p.title} ${p.category} ${p.text}`.toLowerCase().includes(q);
    });

    if (!items.length) {
      grid.innerHTML = `<div class="oa-empty" style="grid-column:1/-1">${activeFilter === 'Favourites' ? 'No favourite prayers saved yet.' : 'No prayers match this search.'}</div>`;
      window.OrthodoxAccessibility?.refreshTranslation?.();
      return;
    }

    grid.innerHTML = items.map(p => {
      const saved = isFavourite(p);
      return `
      <div class="oa-prayer-row">
        <button class="oa-prayer-card oa-prayer-card-button" data-read="${p.id}" type="button" aria-label="Open ${escapeHtml(p.title)}">
          <span class="oa-prayer-cross" aria-hidden="true"><svg viewBox="0 0 24 32" focusable="false"><path d="M12 1v30M8 5h8M5 11h14M7 23l10-5"/></svg></span>
          <span class="oa-prayer-card-copy">
            <span class="oa-category">${escapeHtml(p.category)}</span>
            <strong>${escapeHtml(p.title)}</strong>
          </span>
        </button>
        <button class="oa-prayer-favourite ${saved ? 'is-favourite' : ''}" data-favourite="${p.id}" type="button" aria-pressed="${saved}" aria-label="${saved ? 'Remove' : 'Add'} ${escapeHtml(p.title)} ${saved ? 'from' : 'to'} favourites">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.72 5.51 6.08.88-4.4 4.29 1.04 6.06L12 16.88l-5.44 2.86 1.04-6.06-4.4-4.29 6.08-.88L12 3z"/></svg>
        </button>
      </div>`;
    }).join('');

    requestAnimationFrame(() => window.OrthodoxAccessibility?.refreshTranslation?.());

    grid.querySelectorAll('[data-read]').forEach(button => button.addEventListener('click', () => {
      openPrayer(flat.find(p => p.id === button.dataset.read));
    }));
    grid.querySelectorAll('[data-favourite]').forEach(button => button.addEventListener('click', () => {
      toggleFavourite(flat.find(p => p.id === button.dataset.favourite));
    }));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[c]));
  }

  search.addEventListener('input', render);
  document.getElementById('prayer-modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  renderChips();
  render();
})();
