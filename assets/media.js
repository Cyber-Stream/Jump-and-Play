(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  const hero = document.querySelector('.hero-bg-video');
  const toggle = document.querySelector('.hero-video-toggle');
  const clips = [...document.querySelectorAll('.action-video')];
  let heroVisible = true, userChoice = null, playAttempt = 0;
  const automaticAllowed = () => !reduced.matches && !connection?.saveData;
  const heroWanted = () => heroVisible && !document.hidden && (userChoice === true || (userChoice === null && automaticAllowed()));
  const syncHero = () => {
    const playing = !hero.paused && !hero.ended;
    toggle.textContent = playing ? 'Pause background video' : 'Play background video';
    toggle.setAttribute('aria-label', toggle.textContent);
    toggle.setAttribute('aria-pressed', String(playing));
    hero.dataset.playback = playing ? 'playing' : 'paused';
  };
  const playHero = () => {
    const attempt = ++playAttempt;
    // Set both properties before play(): required for reliable muted playback on iOS.
    hero.muted = true; hero.defaultMuted = true; hero.playsInline = true;
    if (hero.error) hero.load();
    const result = hero.play();
    Promise.resolve(result).then(() => {
      if (attempt !== playAttempt) return;
      if (!heroWanted()) hero.pause();
      syncHero();
    }).catch(() => { hero.dataset.playback = 'blocked'; syncHero(); });
  };
  const updateHero = () => {
    if (heroWanted()) { if (hero.paused) playHero(); }
    else { ++playAttempt; hero.pause(); syncHero(); }
  };
  if (hero && toggle) {
    hero.muted = true; hero.defaultMuted = true; hero.playsInline = true;
    hero.autoplay = false;
    toggle.addEventListener('click', () => {
      const bounds = hero.getBoundingClientRect();
      heroVisible = bounds.bottom > 0 && bounds.top < innerHeight;
      userChoice = hero.paused;
      if (userChoice) playHero(); else { ++playAttempt; hero.pause(); }
      syncHero();
    });
    ['playing', 'pause', 'ended', 'error'].forEach(event => hero.addEventListener(event, syncHero));
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
      heroVisible = entries[entries.length - 1].isIntersecting;
      hero.closest('.hero').classList.toggle('motion-out-of-view', !heroVisible);
      updateHero();
    }, { threshold: .05 }).observe(hero);
    reduced.addEventListener('change', () => { userChoice = null; updateHero(); });
    connection?.addEventListener('change', updateHero);
    updateHero();
  }
  clips.forEach(video => {
    const card = video.closest('.action-card');
    const media = video.closest('.action-media');
    const button = media.querySelector('.action-toggle');
    const status = media.querySelector('.video-status');
    const title = card.querySelector('h3').textContent;
    let loading = false;
    video.playsInline = true;
    video.setAttribute('aria-label', `${title} — Jump & Play video`);
    const sync = () => {
      const playing = !video.paused && !video.ended;
      media.classList.toggle('is-playing', playing);
      button.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${title} video`);
      button.setAttribute('aria-pressed', String(playing));
      if (!loading) media.removeAttribute('aria-busy');
    };
    button.addEventListener('click', () => {
      if (!video.paused && !video.ended) { video.pause(); return; }
      clips.forEach(other => { if (other !== video) other.pause(); });
      loading = true; media.setAttribute('aria-busy', 'true');
      status.textContent = 'Loading video…';
      if (video.error) video.load();
      // Keep play() in the click handler so mobile browsers retain user activation.
      Promise.resolve(video.play()).then(() => {
        loading = false; status.textContent = ''; sync();
      }).catch(() => {
        loading = false;
        status.textContent = 'Unable to play. Tap again to retry, or open the video below.';
        sync();
      });
    });
    video.addEventListener('waiting', () => { if (!video.paused) status.textContent = 'Buffering…'; });
    video.addEventListener('playing', () => { loading = false; status.textContent = ''; sync(); });
    video.addEventListener('error', () => { loading = false; status.textContent = 'Video unavailable. Please try again.'; sync(); });
    ['pause', 'ended'].forEach(event => video.addEventListener(event, sync));
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
      if (!entries[entries.length - 1].isIntersecting) { video.pause(); status.textContent = ''; }
    }, { threshold: .08 }).observe(video);
    sync();
  });
  document.addEventListener('visibilitychange', () => {
    document.documentElement.classList.toggle('page-hidden', document.hidden);
    if (document.hidden) clips.forEach(video => video.pause());
    if (hero) updateHero();
  });
  window.addEventListener('pagehide', () => {
    ++playAttempt; hero?.pause(); clips.forEach(video => video.pause());
  });
  window.addEventListener('pageshow', () => { if (hero) updateHero(); });
})();
