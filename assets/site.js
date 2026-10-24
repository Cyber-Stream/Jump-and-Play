// ── INTRO SEQUENCE ──
  function skipIntro() { triggerTransition(); }

  let introFinished = false;
  function triggerTransition() {
    if (introFinished) return;
    introFinished = true;
    const intro = document.getElementById('introScreen');
    const content = document.getElementById('heroContent');
    intro.classList.add('hide');
    setTimeout(() => {
      intro.style.display = 'none';
      content.classList.add('show');
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 800);
  }

  setTimeout(triggerTransition, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 2200);

  // Reveal each section once, with bounded sibling staggering.
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: '0px 0px -24px 0px' });
    reveals.forEach(el => {
      const siblings = [...el.parentElement.children].filter(child => child.classList.contains('reveal'));
      el.style.setProperty('--reveal-delay', `${Math.min(siblings.indexOf(el), 3) * 85}ms`);
      obs.observe(el);
    });
    document.documentElement.classList.add('motion-ready');
  } else { reveals.forEach(el => el.classList.add('visible')); }

  // Portrait player and restrained editorial text reveal.
  const actionCards = document.querySelectorAll('.action-card');
  const copyObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.closest('.action-card').classList.add('copy-visible');
      } else {
        entry.target.closest('.action-card').classList.remove('copy-visible');
      }
    });
  }, { threshold: .3 });
  actionCards.forEach(card => {
    let wordIndex = 0;
    card.querySelectorAll('.action-player-tag, .action-info h3, .action-info p').forEach(element => {
      const copy = element.textContent.trim();
      element.setAttribute('aria-label', copy);
      element.textContent = '';
      copy.split(/\s+/).forEach((word, index) => {
        if (index) element.append(document.createTextNode(' '));
        const span = document.createElement('span');
        span.className = 'action-word';
        span.setAttribute('aria-hidden', 'true');
        span.style.setProperty('--word-delay', `${200 + wordIndex++ * 95}ms`);
        span.textContent = word;
        element.append(span);
      });
    });
    copyObserver.observe(card.querySelector('.action-info'));
    card.querySelector('video').addEventListener('play', () => {
      if (reducedMotion.matches) return;
      card.classList.remove('copy-visible');
      void card.offsetWidth;
      card.classList.add('copy-visible');
    });
  });

  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    triggerTransition();
    document.documentElement.classList.remove('motion-ready');
    reveals.forEach(element => element.classList.add('visible'));
    actionCards.forEach(card => card.classList.add('copy-visible'));
  });


  function initImageCarousel(galleryId, triggerId) {
  // Native modal keeps keyboard focus within the five-image collection.
  const techGallery = document.getElementById(galleryId);
  const galleryOpen = document.getElementById(triggerId);
  let galleryClosing = false;
  let previousBodyOverflow = '';
  galleryOpen.addEventListener('click', () => {
    if (techGallery.open) return;
    previousBodyOverflow = document.body.style.overflow;
    techGallery.classList.remove('is-closing');
    techGallery.showModal();
    document.body.style.overflow = 'hidden';
  });
  const closeGallery = () => {
    if (!techGallery.open || galleryClosing) return;
    galleryClosing = true;
    techGallery.classList.add('is-closing');
    setTimeout(() => {
      techGallery.close();
      techGallery.classList.remove('is-closing');
      galleryClosing = false;
    }, reducedMotion.matches ? 0 : 240);
  };
  techGallery.querySelector('.gallery-close').addEventListener('click', closeGallery);
  techGallery.addEventListener('cancel', event => { event.preventDefault(); closeGallery(); });
  techGallery.addEventListener('click', event => {
    const bounds = techGallery.getBoundingClientRect();
    if (event.target === techGallery && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) closeGallery();
  });
  techGallery.addEventListener('close', () => {
    document.body.style.overflow = previousBodyOverflow;
    galleryOpen.focus({ preventScroll: true });
  });


  const carouselStage = techGallery.querySelector('.carousel-stage');
  const carouselRing = techGallery.querySelector('.carousel-ring');
  const carouselPause = techGallery.querySelector('.carousel-pause');
  const carouselStep = 360 / carouselRing.querySelectorAll('figure').length;
  carouselRing.style.setProperty('--carousel-step', `${carouselStep}deg`);
  let carouselAngle = 0, carouselTarget = 0, carouselFrame = 0, carouselTime = 0;
  let carouselPaused = reducedMotion.matches, carouselDragging = false, carouselPointerX = 0;
  const updateCarouselButton = () => {
    carouselPause.textContent = carouselPaused ? 'Resume rotation' : 'Pause rotation';
    carouselPause.setAttribute('aria-pressed', String(carouselPaused));
  };
  const drawCarousel = time => {
    carouselFrame = 0;
    if (!techGallery.open || document.hidden) { carouselTime = 0; return; }
    const delta = carouselTime ? Math.min((time - carouselTime) / 1000, .05) : 0;
    carouselTime = time;
    if (!carouselPaused && !carouselDragging && !reducedMotion.matches) carouselTarget -= delta * 18;
    carouselAngle = reducedMotion.matches || carouselDragging ? carouselTarget : carouselAngle + (carouselTarget - carouselAngle) * (1 - Math.exp(-delta * 9));
    carouselRing.style.transform = `rotateY(${carouselAngle}deg)`;
    if ((!carouselPaused && !reducedMotion.matches) || carouselDragging || Math.abs(carouselTarget - carouselAngle) > .01) requestCarousel();
  };
  const requestCarousel = () => { if (!carouselFrame && techGallery.open && !document.hidden) carouselFrame = requestAnimationFrame(drawCarousel); };
  const startCarousel = () => {
    carouselPaused = reducedMotion.matches;
    carouselDragging = false;
    carouselTime = 0;
    updateCarouselButton();
    requestCarousel();
  };
  galleryOpen.addEventListener('click', startCarousel);
  techGallery.addEventListener('close', () => {
    cancelAnimationFrame(carouselFrame); carouselFrame = 0; carouselTime = 0; carouselDragging = false;
  });
  carouselPause.addEventListener('click', () => { carouselPaused = !carouselPaused; if (carouselPaused) carouselTarget = carouselAngle; carouselTime = 0; updateCarouselButton(); requestCarousel(); });
  const stepCarousel = direction => { carouselPaused = true; carouselTarget = Math.round(carouselTarget / carouselStep) * carouselStep + direction * carouselStep; updateCarouselButton(); requestCarousel(); };
  techGallery.querySelector('.carousel-prev').addEventListener('click', () => stepCarousel(1));
  techGallery.querySelector('.carousel-next').addEventListener('click', () => stepCarousel(-1));
  carouselStage.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); stepCarousel(event.key === 'ArrowLeft' ? 1 : -1); }
  });
  let carouselResumeAfterDrag = false;
  carouselStage.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    carouselResumeAfterDrag = !carouselPaused;
    carouselDragging = true; carouselPaused = true; carouselPointerX = event.clientX;
    carouselTarget = carouselAngle;
    carouselStage.setPointerCapture(event.pointerId); updateCarouselButton();
    requestCarousel();
  });
  carouselStage.addEventListener('pointermove', event => {
    if (!carouselDragging) return;
    carouselTarget += (event.clientX - carouselPointerX) * .45; carouselPointerX = event.clientX;
    requestCarousel();
  });
  const endCarouselDrag = () => {
    if (!carouselDragging) return;
    carouselDragging = false;
    if (carouselResumeAfterDrag && !reducedMotion.matches) carouselPaused = false;
    updateCarouselButton();
    requestCarousel();
  };
  carouselStage.addEventListener('pointerup', endCarouselDrag);
  carouselStage.addEventListener('pointercancel', endCarouselDrag);
  carouselStage.addEventListener('lostpointercapture', endCarouselDrag);
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) { carouselPaused = true; updateCarouselButton(); requestCarousel(); } });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(carouselFrame); carouselFrame = 0; carouselTime = 0;
    if (!document.hidden) requestCarousel();
  });

  // Cycle the visible stack preview as well as the expanded 3D collection.
  const stackCards = [...galleryOpen.querySelectorAll('.tech-stack-card')];
  let stackTimer = 0, stackVisible = false, stackFront = stackCards.length - 1;
  stackCards.forEach((card, index) => { card.style.zIndex = index; });
  const stopStackCycle = () => { clearInterval(stackTimer); stackTimer = 0; };
  const startStackCycle = () => {
    stopStackCycle();
    if (!stackVisible || reducedMotion.matches || techGallery.open || document.hidden) return;
    stackTimer = setInterval(() => {
      stackFront = (stackFront + 1) % stackCards.length;
      stackCards.forEach((card, index) => {
        const slot = (index - stackFront + stackCards.length - 1 + stackCards.length) % stackCards.length;
        const offset = slot - (stackCards.length - 1) / 2;
        card.style.zIndex = slot;
        card.style.setProperty('--stack-x', `${offset * 9}px`);
        card.style.setProperty('--stack-y', `${-offset * 5}px`);
        card.style.setProperty('--stack-r', `${offset * 4}deg`);
      });
    }, 3000);
  };
  new IntersectionObserver(entries => {
    stackVisible = entries[entries.length - 1].isIntersecting;
    if (stackVisible) startStackCycle(); else stopStackCycle();
  }, { threshold: .15 }).observe(galleryOpen);
  galleryOpen.addEventListener('click', stopStackCycle);
  techGallery.addEventListener('close', startStackCycle);
  document.addEventListener('visibilitychange', startStackCycle);
  reducedMotion.addEventListener('change', startStackCycle);


  }
  initImageCarousel('techGallery', 'techGalleryOpen');
  initImageCarousel('platformGallery', 'platformGalleryOpen');

  // Hand off a complete, encoded request to WhatsApp for the visitor to send.
  function buildWhatsAppRequest(form) {
    const details = new FormData(form);
    const value = key => String(details.get(key) || '').trim();
    const message = [
      'Jump & Play - Platform Request',
      '',
      `Name: ${value('name')}`,
      `Gym / Gaming Zone / Organization: ${value('venue')}`,
      `Email: ${value('email')}`,
      `Phone: ${value('phone')}`,
      '',
      'Message:',
      value('message')
    ].join('\n');
    return `https://wa.me/8801533580699?text=${encodeURIComponent(message)}`;
  }
  function handleSubmit(event) {
    event.preventDefault();
    if (window.submitEnquiry) return window.submitEnquiry(event);
    alert('The form is still loading. Please try again in a moment.');
  }
  document.querySelector('.contact-form').addEventListener('input', event => {
    if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
  });

  // Keep the section indicator aligned with the actual scroll position.
  const sections = [...document.querySelectorAll('section[id]')];
  const navigationLinks = [...document.querySelectorAll('.nav-links a, .nav-logo')];
  const trackerTabs = document.querySelector('.nav-links');
  const trackerIndicator = document.querySelector('.nav-indicator');
  const mainNav = document.querySelector('nav');
  let activeSection = '', navFramePending = false;
  const alignSectionIndicator = () => {
    const active = trackerTabs.querySelector('.is-active');
    trackerIndicator.style.opacity = active ? '1' : '0';
    if (!active) return;
    trackerIndicator.style.transform = `translateX(${active.offsetLeft}px) scaleX(${active.offsetWidth})`;
  };
  const updateSectionNavigation = () => {
    navFramePending = false;
    const readingLine = mainNav.getBoundingClientRect().height + Math.min(innerHeight * .15, 110);
    let current = sections[0].id;
    sections.forEach(section => { if (section.getBoundingClientRect().top <= readingLine) current = section.id; });
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 3) current = 'contact';
    if (activeSection !== current) {
      activeSection = current;
      navigationLinks.forEach(link => {
        const active = link.hash === `#${current}`;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
      });
      const selected = trackerTabs.querySelector('.is-active');
      if (selected) {
        const left = selected.getBoundingClientRect().left - trackerTabs.getBoundingClientRect().left + trackerTabs.scrollLeft, right = left + selected.offsetWidth;
        if (left < trackerTabs.scrollLeft || right > trackerTabs.scrollLeft + trackerTabs.clientWidth)
          trackerTabs.scrollTo({ left: left - (trackerTabs.clientWidth - selected.offsetWidth) / 2, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
      }
    }
    alignSectionIndicator();
  };
  const queueSectionNavigation = () => {
    if (navFramePending) return;
    navFramePending = true; requestAnimationFrame(updateSectionNavigation);
  };
  const measureNavigation = () => {
    document.documentElement.style.setProperty('--nav-height', `${mainNav.getBoundingClientRect().height}px`);
    queueSectionNavigation();
  };
  window.addEventListener('scroll', queueSectionNavigation, { passive: true });
  window.addEventListener('resize', measureNavigation);
  window.addEventListener('hashchange', queueSectionNavigation);
  window.addEventListener('load', measureNavigation);
  if ('ResizeObserver' in window) new ResizeObserver(measureNavigation).observe(mainNav);
  if (document.fonts) document.fonts.ready.then(measureNavigation);
  measureNavigation();
