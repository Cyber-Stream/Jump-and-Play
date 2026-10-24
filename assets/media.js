(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  const hero = document.querySelector('.hero-bg-video');
  const toggle = document.querySelector('.hero-video-toggle');
  const heroStatus = document.querySelector('.hero-video-status');
  const clips = [...document.querySelectorAll('.action-video')];
  let heroVisible = true, pageActive = true, userChoice = null, playAttempt = 0;
  let pending = false, blocked = false;
  const automaticAllowed = () => !reduced.matches && !connection?.saveData;
  const heroWanted = () => pageActive && heroVisible && !document.hidden && (userChoice === true || (userChoice === null && automaticAllowed()));
  const syncHero = () => {
    const playing = !hero.paused && !hero.ended;
    toggle.textContent = playing || pending ? 'Pause background video' : 'Play background video';
    toggle.setAttribute('aria-label', toggle.textContent);
    toggle.setAttribute('aria-pressed', String(playing));
    hero.dataset.playback = playing ? 'playing' : blocked ? 'blocked' : pending ? 'loading' : 'paused';
    if (heroStatus) heroStatus.textContent = hero.error ? 'Video unavailable. Tap Play to retry.'
      : blocked ? 'Tap Play to start the background video.' : '';
  };
  const playHero = () => {
    const attempt = ++playAttempt;
    pending = true; blocked = false;
    // Set both properties before play(): required for reliable muted playback on iOS.
    hero.muted = true; hero.defaultMuted = true; hero.playsInline = true;
    if (hero.error) hero.load();
    syncHero();
    // Call play synchronously: a tap must retain Safari's user activation.
    Promise.resolve(hero.play()).then(() => {
      if (attempt !== playAttempt) return;
      pending = false;
      if (!heroWanted()) hero.pause();
      syncHero();
    }).catch(error => {
      if (attempt !== playAttempt) return;
      pending = false;
      // AbortError is a lifecycle interruption, not a permission denial.
      blocked = error.name !== 'AbortError';
      if (blocked) hero.autoplay = false;
      syncHero();
    });
  };
  const updateHero = () => {
    // Preserve native muted autoplay. Safari can start it when the video becomes ready/visible.
    hero.autoplay = heroWanted() && !blocked;
    if (heroWanted()) { if (hero.paused && !pending && !blocked) playHero(); }
    else { ++playAttempt; pending = false; hero.pause(); syncHero(); }
  };
  if (hero && toggle) {
    hero.muted = true; hero.defaultMuted = true; hero.playsInline = true;
    hero.setAttribute('muted', ''); hero.setAttribute('playsinline', '');
    hero.setAttribute('webkit-playsinline', '');
    toggle.addEventListener('click', () => {
      const bounds = hero.getBoundingClientRect();
      heroVisible = bounds.bottom > 0 && bounds.top < innerHeight;
      // Honor the displayed control if Safari changes paused before its media event arrives.
      userChoice = toggle.getAttribute('aria-pressed') !== 'true' && !pending;
      hero.autoplay = userChoice;
      if (userChoice) playHero(); else { ++playAttempt; pending = false; hero.pause(); }
      syncHero();
    });
    hero.addEventListener('playing', () => {
      pending = false; blocked = false;
      if (!heroWanted()) hero.pause();
      syncHero();
    });
    ['pause', 'ended', 'error'].forEach(event => hero.addEventListener(event, syncHero));
    ['loadedmetadata', 'canplay'].forEach(event => hero.addEventListener(event, updateHero));
    // A deliberate interaction with the introduction can unlock silent playback on iOS.
    hero.closest('.hero-stage').addEventListener('click', event => {
      if (!event.target.closest('.hero-video-toggle') && blocked && heroWanted()) playHero();
    });
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
      heroVisible = entries[entries.length - 1].isIntersecting;
      hero.closest('.hero').classList.toggle('motion-out-of-view', !heroVisible);
      updateHero();
    }, { threshold: .05 }).observe(hero);
    reduced.addEventListener('change', () => { userChoice = null; blocked = false; updateHero(); });
    connection?.addEventListener('change', updateHero);
    // Safari can suspend decoding during rotation without a new intersection event.
    let layoutFrame = 0, layoutTimer = 0;
    const refreshFrame = () => {
      layoutFrame = 0;
      const bounds = hero.getBoundingClientRect();
      heroVisible = bounds.bottom > 0 && bounds.top < innerHeight;
      updateHero();
    };
    const scheduleFrameRefresh = () => {
      if (!layoutFrame) layoutFrame = requestAnimationFrame(refreshFrame);
      clearTimeout(layoutTimer);
      layoutTimer = setTimeout(refreshFrame, 200);
    };
    window.addEventListener('resize', scheduleFrameRefresh, { passive: true });
    window.addEventListener('orientationchange', scheduleFrameRefresh, { passive: true });
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
    if (hero) { if (!document.hidden) blocked = false; updateHero(); }
  });
  window.addEventListener('pagehide', () => {
    pageActive = false;
    if (hero) hero.autoplay = false;
    ++playAttempt; pending = false; hero?.pause(); clips.forEach(video => video.pause());
  });
  window.addEventListener('pageshow', () => { pageActive = true; if (hero) { blocked = false; updateHero(); } });
})();
