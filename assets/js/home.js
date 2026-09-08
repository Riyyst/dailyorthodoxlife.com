(() => {
  const greeting = document.querySelector('[data-greeting]');
  if (greeting) {
    const h = new Date().getHours();
    greeting.textContent = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }


  const todayLabel = document.querySelector("[data-today-date]");
  if (todayLabel) {
    const now = new Date();
    todayLabel.textContent = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  }

  const savedLocation = localStorage.getItem('orthodoxBibleLocation');
  const continueEl = document.querySelector('[data-bible-continue]');
  if (continueEl && savedLocation) continueEl.textContent = savedLocation;

  const heroBible = document.querySelector('[data-bible-hero]');
  if (heroBible && savedLocation) heroBible.textContent = `Continue from ${savedLocation}, or choose another book and chapter.`;

  const carousel = document.querySelector('[data-hero-carousel]');
  const track = document.querySelector('[data-hero-track]');
  const slides = [...document.querySelectorAll('[data-hero-slide]')];
  const dots = document.querySelector('[data-hero-dots]');
  if (!carousel || !track || slides.length < 2 || !dots) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0;
  let timer = null;
  let touchStartX = 0;
  let touchStartY = 0;

  dots.innerHTML = slides.map((_, i) => `<button type="button" class="oa-hero-dot${i === 0 ? ' is-active' : ''}" aria-label="Show featured item ${i + 1}" aria-current="${i === 0 ? 'true' : 'false'}" data-hero-dot="${i}"></button>`).join('');
  const dotButtons = [...dots.querySelectorAll('[data-hero-dot]')];

  function render(nextIndex, userInitiated = false) {
    index = (nextIndex + slides.length) % slides.length;
    track.style.transform = `translate3d(-${index * 100}%, 0, 0)`;
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-current', i === index);
      slide.setAttribute('aria-hidden', i === index ? 'false' : 'true');
    });
    dotButtons.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === index);
      dot.setAttribute('aria-current', i === index ? 'true' : 'false');
    });
    if (userInitiated) restart();
  }

  function start() {
    if (reduceMotion || document.hidden) return;
    stop();
    timer = window.setInterval(() => render(index + 1), 6500);
  }

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  function restart() {
    stop();
    start();
  }

  dotButtons.forEach(dot => dot.addEventListener('click', () => render(Number(dot.dataset.heroDot), true)));
  carousel.addEventListener('mouseenter', stop);
  carousel.addEventListener('mouseleave', start);
  carousel.addEventListener('focusin', stop);
  carousel.addEventListener('focusout', start);

  carousel.addEventListener('touchstart', event => {
    const touch = event.changedTouches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    stop();
  }, { passive: true });

  carousel.addEventListener('touchend', event => {
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.15) render(index + (dx < 0 ? 1 : -1));
    start();
  }, { passive: true });

  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  render(0);
  start();
})();
