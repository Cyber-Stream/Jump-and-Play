(() => {
  const host = document.getElementById('jumpExperience');
  if (!host) return;
  const viewport = host.querySelector('.experience-viewport');
  const status = host.querySelector('.experience-status');
  const steps = [...host.querySelectorAll('.experience-step')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (error) {
    host.classList.add('experience-fallback');
    status.textContent = 'Your jump → pressure sensors → wireless controller → dinosaur jump';
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Animated 3D demonstration: a child jumps on the pressure-sensing platform, a wireless signal travels to a television, and a dinosaur jumps over an obstacle.');
  viewport.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 80);
  camera.position.set(6.5, 5.5, 10.8);
  const target = new THREE.Vector3(.1, 1.05, 0);
  camera.lookAt(target);
  scene.add(new THREE.HemisphereLight(0xd3eaff, 0x22304e, 2.2));
  const key = new THREE.DirectionalLight(0xfff0dd, 4);
  key.position.set(-4, 10, 7); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 8, bottom: -8 });
  key.shadow.bias = -.0005; scene.add(key);
  const rim = new THREE.DirectionalLight(0x53bfff, 2.8); rim.position.set(5, 6, -6); scene.add(rim);
  const fill = new THREE.PointLight(0x9065ff, 22, 15); fill.position.set(-4, 3, -3); scene.add(fill);
  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .55, ...extra });
  const navy = material(0x172944), cyan = material(0x48e1ed), white = material(0xe5eef6);
  const skin = material(0xc88c65), hair = material(0x241e2a), orange = material(0xff8655);
  const shoeMat = material(0xf1f4ee), dark = material(0x09121e), steel = material(0x263c50, { metalness: .5 });
  const glow = material(0x21cbd7, { emissive: 0x00d5e8, emissiveIntensity: .6 });
  const mesh = (geometry, mat, parent = scene, position = [0, 0, 0]) => {
    const object = new THREE.Mesh(geometry, mat); object.position.set(...position);
    object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  };
  const box = (w, h, d, mat, parent, position) => mesh(new THREE.BoxGeometry(w, h, d), mat, parent, position);
  const round = (w, h, d, r, mat, parent, position) => {
    const x = -w / 2 + r, y = -h / 2 + r, a = w - 2 * r, b = h - 2 * r;
    const shape = new THREE.Shape();
    shape.moveTo(x, y); shape.lineTo(x + a, y); shape.lineTo(x + a, y + b); shape.lineTo(x, y + b); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(.01, d - 2 * r), bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: r, bevelThickness: r });
    geo.center(); return mesh(geo, mat, parent, position);
  };
  const sphere = (r, mat, parent, position, scale) => {
    const o = mesh(new THREE.SphereGeometry(r, 24, 16), mat, parent, position); if (scale) o.scale.set(...scale); return o;
  };
  // A softly lit exhibition plinth grounds the entire connected experience.
  round(9.3, .25, 4.7, .1, material(0x15243b), scene, [0, -.27, -.3]);
  round(9.1, .08, 4.5, .03, material(0x23354c), scene, [0, -.1, -.3]);
  const platform = new THREE.Group(); platform.position.set(-2.2, .05, .55); scene.add(platform);
  round(2.65, .22, 2.1, .07, dark, platform, [0, 0, 0]);
  round(2.52, .06, 1.97, .02, material(0x33495b), platform, [0, .14, 0]);
  const pads = [];
  for (let x = 0; x < 4; x++) for (let z = 0; z < 3; z++) {
    const mat = material(0x405b6b, { emissive: 0x00b8ce, emissiveIntensity: .035 });
    pads.push(round(.52, .025, .5, .008, mat, platform, [(x - 1.5) * .59, .185, (z - 1) * .59]));
  }
  round(2.5, .025, .035, .008, glow, platform, [0, .03, 1.04]);
  const controller = round(.52, .2, .38, .035, navy, scene, [-.64, .08, .6]);
  round(.22, .018, .2, .006, steel, controller, [0, .11, 0]);
  sphere(.035, glow, controller, [.16, .12, .08]);
  const pressureRing = mesh(new THREE.RingGeometry(.48, .51, 64), new THREE.MeshBasicMaterial({ color: 0x45e6f1, transparent: true, opacity: 0, side: THREE.DoubleSide }), platform, [0, .213, 0]);
  pressureRing.rotation.x = -Math.PI / 2;
  // Stylized child with articulated arms and legs, shaped entirely in 3D.
  const kid = new THREE.Group(); kid.position.set(-2.2, .22, .55); kid.rotation.y = .42; scene.add(kid);
  const upper = new THREE.Group(); kid.add(upper);
  round(.79, .87, .46, .1, orange, upper, [0, 1.84, 0]);
  round(.52, .08, .06, .02, white, upper, [0, 1.91, .235]);
  sphere(.13, skin, upper, [0, 2.33, 0], [1, 1.35, 1]);
  sphere(.47, skin, upper, [0, 2.79, 0], [.91, 1.04, .9]);
  sphere(.45, hair, upper, [0, 3.01, -.055], [1, .64, 1]);
  for (let i = 0; i < 5; i++) sphere(.16, hair, upper, [(i - 2) * .14, 3.12 + Math.sin(i) * .035, .19]);
  sphere(.105, skin, upper, [-.43, 2.8, 0], [.7, 1, 1]); sphere(.105, skin, upper, [.43, 2.8, 0], [.7, 1, 1]);
  for (const x of [-.16, .16]) {
    sphere(.075, white, upper, [x, 2.84, .365], [.8, 1, .45]);
    sphere(.037, dark, upper, [x + .014, 2.84, .398], [.8, 1, .5]);
    round(.12, .026, .025, .008, hair, upper, [x, 2.97, .36]);
  }
  sphere(.065, skin, upper, [0, 2.72, .42], [.7, .8, 1]);
  const smile = new THREE.CatmullRomCurve3([new THREE.Vector3(-.1, 2.63, .38), new THREE.Vector3(0, 2.6, .405), new THREE.Vector3(.1, 2.63, .38)]);
  mesh(new THREE.TubeGeometry(smile, 12, .015, 5, false), material(0x723e37), upper);
  round(.66, .33, .45, .06, navy, upper, [0, 1.32, 0]);
  const joints = [], limbs = [];
  for (const side of [-1, 1]) {
    const leg1 = mesh(new THREE.CylinderGeometry(.14, .12, 1, 12), navy, kid);
    const leg2 = mesh(new THREE.CylinderGeometry(.11, .09, 1, 12), skin, kid);
    const shoe = round(.27, .19, .49, .06, shoeMat, kid, [side * .23, .12, .1]);
    round(.28, .055, .5, .02, cyan, shoe, [0, -.08, 0]);
    const arm1 = mesh(new THREE.CylinderGeometry(.13, .11, 1, 12), orange, upper);
    const arm2 = mesh(new THREE.CylinderGeometry(.095, .08, 1, 12), skin, upper);
    const hand = sphere(.11, skin, upper, [0, 0, 0]);
    limbs.push({ side, leg1, leg2, arm1, arm2, hand });
  }
  const up = new THREE.Vector3(0, 1, 0), va = new THREE.Vector3(), vb = new THREE.Vector3();
  const bone = (object, a, b) => {
    va.set(...a); vb.set(...b); object.position.copy(va).add(vb).multiplyScalar(.5);
    vb.sub(va); object.scale.y = vb.length(); object.quaternion.setFromUnitVectors(up, vb.normalize());
  };
  // Television and live, synchronized dinosaur game texture.
  const tv = new THREE.Group(); tv.position.set(2.55, 0, -.55); tv.rotation.y = -.12; scene.add(tv);
  round(1.7, .12, .9, .04, steel, tv, [0, .03, 0]);
  round(.2, 1.1, .18, .04, steel, tv, [0, .6, -.1]);
  round(3.65, 2.24, .2, .055, dark, tv, [0, 2.12, 0]);
  const gameCanvas = document.createElement('canvas'); gameCanvas.width = 960; gameCanvas.height = 540;
  const ctx = gameCanvas.getContext('2d');
  const texture = new THREE.CanvasTexture(gameCanvas); texture.colorSpace = THREE.SRGBColorSpace;
  const screen = mesh(new THREE.PlaneGeometry(3.43, 2), new THREE.MeshBasicMaterial({ map: texture }), tv, [0, 2.15, .112]);
  sphere(.025, glow, tv, [0, 1.05, .12]);
  const path = new THREE.CatmullRomCurve3([new THREE.Vector3(-.55, .25, .6), new THREE.Vector3(.1, .7, 1.1), new THREE.Vector3(1, 1.1, 1.2), new THREE.Vector3(2.5, 1.2, -.3)]);
  mesh(new THREE.TubeGeometry(path, 48, .012, 6, false), new THREE.MeshBasicMaterial({ color: 0x346f88, transparent: true, opacity: .5 }));
  const packets = [0, 1, 2].map(() => sphere(.055, glow));
  const cactus = (x, y, scale = 1) => {
    ctx.fillStyle = '#407c83'; ctx.fillRect(x, y - 55 * scale, 12 * scale, 55 * scale);
    ctx.fillRect(x - 15 * scale, y - 35 * scale, 39 * scale, 10 * scale);
    ctx.fillRect(x - 15 * scale, y - 49 * scale, 9 * scale, 23 * scale);
    ctx.fillRect(x + 17 * scale, y - 46 * scale, 9 * scale, 21 * scale);
  };
  const drawGame = (time, dinoJump, airborne) => {
    const sky = ctx.createLinearGradient(0, 0, 0, 540); sky.addColorStop(0, '#dceff0'); sky.addColorStop(1, '#eff3de');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 960, 540);
    ctx.fillStyle = '#f5df9c'; ctx.beginPath(); ctx.arc(760, 135, 43, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c2d9d3'; ctx.beginPath(); ctx.moveTo(0, 375);
    for (let x = 0; x <= 960; x += 20) ctx.lineTo(x, 324 + Math.sin(x / 115) * 22 + Math.cos(x / 170) * 18);
    ctx.lineTo(960, 440); ctx.lineTo(0, 440); ctx.fill();
    ctx.fillStyle = '#193e4d'; ctx.font = '600 24px sans-serif'; ctx.fillText('DINO / JUMP & PLAY', 48, 54);
    ctx.font = '18px monospace'; ctx.fillText('SCORE ' + String(Math.floor(time * 15)).padStart(5, '0'), 740, 54);
    ctx.fillStyle = '#b3c8bc'; ctx.fillRect(0, 422, 960, 118); ctx.fillStyle = '#6c9188'; ctx.fillRect(0, 420, 960, 3);
    ctx.fillStyle = '#94b0a3'; for (let i = 0; i < 18; i++) ctx.fillRect((i * 67 - time * 120 % 67 + 960) % 960, 443 + i % 3 * 18, 20, 3);
    // This obstacle crosses the dinosaur exactly during its airborne phase.
    const phase = time % 3.6 / 3.6;
    cactus(650 - phase * 780, 420); cactus(1080 - phase * 780, 420, .7);
    const y = 415 - dinoJump * 145;
    ctx.fillStyle = '#164a53';
    const pixel = 9, dx = 260;
    const pixels = ['      1111111','      1111011','      1111111','      1111   ','1    1111   ','11  111111  ','111111111   ',' 11111111   ','  111111    ','   11 11    '];
    pixels.forEach((row, r) => [...row].forEach((v, c) => { if (v === '1') ctx.fillRect(dx + c * pixel, y - 108 + r * pixel, pixel, pixel); }));
    const stride = airborne ? 0 : Math.sin(time * 20) * 7;
    ctx.fillRect(dx + 27, y - 20, 9, 17 + stride); ctx.fillRect(dx + 54, y - 20, 9, 17 - stride);
    ctx.fillStyle = airborne ? '#177c77' : '#5b7975'; ctx.font = '600 17px sans-serif';
    ctx.fillText(airborne ? 'JUMP RECEIVED' : 'YOUR MOVEMENT. YOUR GAME.', 48, 500);
    texture.needsUpdate = true;
  };
  // The scene plays continuously; it only stops drawing while offscreen or hidden.
  const playing = true;
  let visible = false, frame = 0, last = 0, elapsed = 0, lastState = -1;
  let pointerX = 0, pointerY = 0, gameTick = -1;
  const pose = time => {
    const phase = time % 3.6 / 3.6;
    const flight = Math.max(0, Math.min(1, (phase - .24) / .4));
    const jump = phase >= .24 && phase <= .64 ? Math.sin(flight * Math.PI) : 0;
    const crouch = phase > .08 && phase < .24 ? Math.sin((phase - .08) / .16 * Math.PI) : phase > .64 && phase < .78 ? .6 * Math.sin((phase - .64) / .14 * Math.PI) : 0;
    kid.position.y = .22 + jump * 1.1;
    upper.position.y = -crouch * .32;
    upper.rotation.x = crouch * .12;
    for (const limb of limbs) {
      const x = limb.side * .23, hip = 1.3 - crouch * .32;
      bone(limb.leg1, [x, hip, 0], [x, .73 - crouch * .1, .12 + crouch * .24]);
      bone(limb.leg2, [x, .73 - crouch * .1, .12 + crouch * .24], [x, .22, .04]);
      const elbow = [limb.side * (.55 + jump * .15), 1.72 + jump * .5, .1];
      const hand = [limb.side * (.6 + jump * .22), 1.4 + jump * 1.23, .17];
      bone(limb.arm1, [limb.side * .37, 2.13, 0], elbow); bone(limb.arm2, elbow, hand); limb.hand.position.set(...hand);
    }
    const pressed = crouch > .2 || phase > .23 && phase < .31;
    pads.forEach(pad => { pad.material.emissiveIntensity = pressed ? .7 : .035; });
    const pulse = (phase - .24) / .35;
    pressureRing.material.opacity = pulse > 0 && pulse < 1 ? (1 - pulse) * .65 : 0;
    pressureRing.scale.setScalar(1 + Math.max(0, pulse) * 2);
    packets.forEach((packet, i) => {
      const travel = (phase - .24 - i * .018) / .12;
      packet.visible = travel >= 0 && travel <= 1;
      if (packet.visible) packet.position.copy(path.getPoint(travel));
    });
    const dinoFlight = Math.max(0, Math.min(1, (phase - .285) / .4));
    const dinoJump = phase >= .285 && phase <= .685 ? Math.sin(dinoFlight * Math.PI) : 0;
    const tick = Math.floor(time * 30);
    if (tick !== gameTick) { drawGame(time, dinoJump, dinoJump > .05); gameTick = tick; }
    const state = phase < .24 || phase > .685 ? 0 : phase < .36 ? 1 : 2;
    if (state !== lastState) {
      steps.forEach((step, i) => step.classList.toggle('is-active', i === state));
      status.textContent = ['Ready for the next jump', 'Jump detected · wireless signal sent', 'Signal received · dinosaur airborne'][state];
      host.dataset.phase = ['ready', 'signal', 'game'][state]; lastState = state;
    }
  };
  const render = timestamp => {
    frame = 0;
    if (!visible || document.hidden) { last = 0; return; }
    if (playing && last) elapsed += Math.min((timestamp - last) / 1000, .05);
    last = timestamp; pose(elapsed);
    camera.position.x += (6.5 + pointerX * .5 - camera.position.x) * .05;
    camera.position.y += (5.5 + pointerY * .25 - camera.position.y) * .05;
    camera.lookAt(target); renderer.render(scene, camera);
    if (playing) frame = requestAnimationFrame(render);
  };
  const requestRender = () => { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(render); };
  const resize = () => {
    const width = viewport.clientWidth, height = viewport.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height;
    camera.fov = width < 600 ? 46 : 32; camera.updateProjectionMatrix(); requestRender();
  };
  new ResizeObserver(resize).observe(viewport);
  new IntersectionObserver(entries => {
    visible = entries[entries.length - 1].isIntersecting;
    if (!visible) { cancelAnimationFrame(frame); frame = 0; last = 0; }
    else requestRender();
  }, { threshold: .08 }).observe(viewport);
  viewport.addEventListener('pointermove', event => {
    if (motion.matches || event.pointerType === 'touch') return;
    const bounds = viewport.getBoundingClientRect(); pointerX = (event.clientX - bounds.left) / bounds.width - .5; pointerY = (event.clientY - bounds.top) / bounds.height - .5;
  });
  viewport.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
  document.addEventListener('visibilitychange', () => { last = 0; requestRender(); });
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); cancelAnimationFrame(frame); frame = 0; host.classList.add('experience-fallback'); status.textContent = '3D view unavailable. Jump → sensor → wireless signal → dinosaur jump.'; });
  pose(0); resize(); host.dataset.ready = 'true';
})();
