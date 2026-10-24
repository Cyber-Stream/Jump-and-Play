(() => {
  'use strict';
  const runtime = document.currentScript.dataset.runtime;
  const hosts = [...document.querySelectorAll('[data-scene]')];
  hosts.forEach(host => host.querySelectorAll('button').forEach(button => { button.disabled = true; }));
  let runtimeReady;
  const script = src => new Promise((resolve, reject) => {
    const element = document.createElement('script');
    element.src = src;
    element.onload = resolve;
    element.onerror = reject;
    document.head.append(element);
  });
  const load = async host => {
    if (host.dataset.loading) return;
    host.dataset.loading = 'true';
    host.setAttribute('aria-busy', 'true');
    try {
      runtimeReady ||= script(runtime).then(() => {
        if (!window.THREE) throw new Error('3D runtime unavailable');
      });
      await runtimeReady;
      await script(host.dataset.scene);
      if (!host.dataset.ready && !host.classList.contains('experience-fallback')) throw new Error('3D scene unavailable');
    } catch {
      host.classList.add('experience-fallback');
      host.querySelector('.experience-status').textContent = host.id === 'howExperience'
        ? 'Follow the six steps below to connect your platform and play.'
        : 'Your jump activates the pressure sensors. The wireless controller sends that movement to the game.';
      host.querySelectorAll('.experience-controls button').forEach(button => { button.disabled = true; });
    } finally {
      host.querySelectorAll('button').forEach(button => { button.disabled = host.classList.contains('experience-fallback'); });
      host.removeAttribute('aria-busy');
    }
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { observer.unobserve(entry.target); load(entry.target); }
    }), { rootMargin: '300px 0px' });
    hosts.forEach(host => observer.observe(host));
  } else { hosts.forEach(load); }
})();
