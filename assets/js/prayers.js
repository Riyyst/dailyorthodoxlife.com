(() => {
  const data = window.ORTHODOX_DAILY_PRAYERS || [];
  const grid = document.getElementById('prayer-grid');
  const search = document.getElementById('prayer-search');
  const chips = document.getElementById('prayer-filters');
  const modal = document.getElementById('prayer-modal');
  const modalTitle = document.getElementById('prayer-modal-title');
  const modalCategory = document.getElementById('prayer-modal-category');
  const modalText = document.getElementById('prayer-modal-text');
  let activeFilter = new URLSearchParams(window.location.search).get('category') || 'All';

  const flat = data.flatMap((cat, ci) => (cat.prayers || []).map((p, pi) => ({
    ...p,
    category: cat.category,
    id: `${ci}-${pi}`
  })));

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
    const categories = ['All', ...data.map(x => x.category)];
    if (!categories.includes(activeFilter)) activeFilter = 'All';
    chips.innerHTML = categories.map(c => `
      <button class="oa-filter-chip ${c === activeFilter ? 'is-active' : ''}" data-filter="${escapeHtml(c)}" type="button">
        ${escapeHtml(c)}
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
      if (activeFilter !== 'All' && p.category !== activeFilter) return false;
      return !q || `${p.title} ${p.category} ${p.text}`.toLowerCase().includes(q);
    });

    if (!items.length) {
      grid.innerHTML = '<div class="oa-empty" style="grid-column:1/-1">No prayers match this search.</div>';
      return;
    }

    grid.innerHTML = items.map(p => `
      <button class="oa-prayer-card oa-prayer-card-button" data-read="${p.id}" type="button" aria-label="Open ${escapeHtml(p.title)}">
        <span class="oa-prayer-cross" aria-hidden="true">☦</span>
        <span class="oa-prayer-card-copy">
          <span class="oa-category">${escapeHtml(p.category)}</span>
          <strong>${escapeHtml(p.title)}</strong>
        </span>
      </button>`).join('');

    grid.querySelectorAll('[data-read]').forEach(button => button.addEventListener('click', () => {
      openPrayer(flat.find(p => p.id === button.dataset.read));
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
