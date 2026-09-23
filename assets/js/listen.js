(() => {
  const audioApi = window.OrthodoxAudio;
  if (!audioApi) return;
  const tracks = audioApi.tracks;
  const list = document.getElementById('track-list');
  const featured = document.getElementById('play-featured');
  if (list) {
    list.classList.add('notranslate');
    list.setAttribute('translate', 'no');
  }
  const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7.4 17.2 12 9 16.6Z" fill="currentColor" stroke="none"/></svg>';
  const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h3v12H8zM13 6h3v12h-3z" fill="currentColor" stroke="none"/></svg>';

  function render() {
    list.innerHTML = tracks.map((track, i) => `
      <button class="oa-track" data-index="${i}" type="button" aria-label="Play ${track.title}">
        <span class="oa-track-play">${playIcon}</span>
        <span class="oa-track-copy">
          <strong>${track.title}</strong>
          <span class="oa-track-tradition">${track.tradition}</span>
        </span>
      </button>`).join('');
    highlight();
  }

  function highlight() {
    const currentIndex = audioApi.currentIndex;
    const playing = audioApi.isPlaying;
    list.querySelectorAll('.oa-track').forEach(item => {
      const active = Number(item.dataset.index) === currentIndex;
      item.classList.toggle('is-playing', active);
      const icon = item.querySelector('.oa-track-play');
      if (icon) icon.innerHTML = active && playing ? pauseIcon : playIcon;
    });
  }

  window.addEventListener('orthodoxaudiochange', highlight);
  document.addEventListener('click', event => {
    const track = event.target.closest?.('#track-list .oa-track');
    if (track) {
      audioApi.start(Number(track.dataset.index));
      return;
    }
    if (event.target.closest?.('#play-featured')) {
      if (typeof audioApi.shuffle === 'function') audioApi.shuffle();
      else audioApi.start(Math.floor(Math.random() * tracks.length));
    }
  }, true);

  const tabs = [...document.querySelectorAll('[data-audio-tab]')];
  const panels = [...document.querySelectorAll('[data-audio-panel]')];
  function activateTab(target) {
    tabs.forEach(item => {
      const active = item.dataset.audioTab === target;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
    });
    panels.forEach(panel => {
      const active = panel.dataset.audioPanel === target;
      panel.hidden = !active;
      if (active) panel.querySelectorAll('.oa-reveal').forEach(el => el.classList.add('is-visible'));
    });
  }
  tabs.forEach(tab => tab.addEventListener('click', () => activateTab(tab.dataset.audioTab)));

  const startTab = new URLSearchParams(window.location.search).get('tab');
  render();
  if (startTab === 'spoken') activateTab('spoken');
})();
