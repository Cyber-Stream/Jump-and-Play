  // The laptop makes the pairing and game-launch stages explicit.
  const laptop = new THREE.Group(); laptop.position.set(.25, .02, 1.15); laptop.rotation.y = -.16; scene.add(laptop);
  round(1.55, .08, 1.05, .025, steel, laptop, [0, .08, 0]);
  round(1.22, .015, .5, .004, navy, laptop, [0, .128, -.12]);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 9; col++)
    box(.095, .012, .085, material(0x728ba0), laptop, [(col - 4) * .128, .145, -.29 + row * .12]);
  round(.4, .012, .2, .004, material(0x778b9e), laptop, [0, .13, .3]);
  const lid = new THREE.Group(); lid.position.set(0, .14, -.47); lid.rotation.x = -.18; laptop.add(lid);
  round(1.55, 1, .065, .02, dark, lid, [0, .5, 0]);
  const laptopCanvas = document.createElement('canvas'); laptopCanvas.width = 640; laptopCanvas.height = 400;
  const laptopCtx = laptopCanvas.getContext('2d');
  const laptopTexture = new THREE.CanvasTexture(laptopCanvas); laptopTexture.colorSpace = THREE.SRGBColorSpace;
  const laptopScreen = mesh(new THREE.PlaneGeometry(1.42, .86), new THREE.MeshBasicMaterial({ map: laptopTexture }), lid, [0, .5, .038]);
  const powerMat = material(0x132a35, { emissive: 0x37e8b5, emissiveIntensity: 0 });
  const powerButton = mesh(new THREE.CylinderGeometry(.065, .065, .025, 24), powerMat, controller, [0, .13, .08]);
  const sensorPositions = [[-.82,-.58],[0,-.58],[.82,-.58],[-.82,.58],[0,.58],[.82,.58],[0,0]];
  const sensors = sensorPositions.map(([x,z]) => sphere(.09, material(0x53e9ed, { emissive: 0x11c6e0, emissiveIntensity: .2 }), platform, [x,.24,z]));
  const signalRings = [0,1,2].map(() => {
    const o = mesh(new THREE.TorusGeometry(.25,.012,8,48), new THREE.MeshBasicMaterial({ color:0x57ddeb,transparent:true,opacity:0 }));
    o.position.set(-.6,.42,.65); o.rotation.x = -Math.PI/2; return o;
  });
  const titles = ['Power on the platform','Pair over Bluetooth','Open a compatible game','Step on and jump','Seven sensors detect movement','Play, compete, repeat'];
  const captions = [
    'The rechargeable controller powers the platform. Look for the ready light.',
    'Pair the controller with your phone, tablet, or computer over Bluetooth.',
    'Launch a compatible Jump & Play game on the connected device.',
    'Step onto the platform and jump naturally. Your body is the controller.',
    'The seven pressure sensors detect the jump. The controller sends the input.',
    'The game responds to your movement. Keep jumping and chase your next score.'
  ];
  const stageTitle = host.querySelector('.walkthrough-title');
  const stageDescription = host.querySelector('.walkthrough-description');
  const stageCounter = host.querySelector('.walkthrough-counter');
  const progress = host.querySelector('.walkthrough-progress-fill');
  const cameraPositions = [[2.4,3.7,6.6],[4.6,4.1,8.6],[4.1,3.6,7.8],[6.5,5.5,10.8],[3.8,5.7,7.3],[6.5,5.5,10.8]];
  const cameraTargets = [[-1,.35,.7],[-.3,.6,.8],[1.1,1,.15],[.1,1.05,0],[-1.25,.55,.6],[.1,1.05,0]];
  const desiredPosition = new THREE.Vector3(), desiredTarget = new THREE.Vector3();
  const pairLine = new THREE.CatmullRomCurve3([new THREE.Vector3(-.6,.3,.6),new THREE.Vector3(-.2,1.3,1.1),new THREE.Vector3(.2,1.1,1)]);
  const pairingPackets = [0,1,2,3].map(() => sphere(.035,glow));
  let playing = !motion.matches, visible = false, frame = 0, last = 0, elapsed = 0, currentStage = -1;
  let gameTick = -1, notebookStage = -1;
  const totalDuration = 30, stageDuration = 5;
  const setButtons = () => { pauseButton.textContent = playing ? 'Pause walkthrough' : 'Play walkthrough'; pauseButton.setAttribute('aria-pressed',String(!playing)); };
  const drawNotebook = (stage, local) => {
    const c = laptopCtx; c.fillStyle = '#0d1e31'; c.fillRect(0,0,640,400);
    c.fillStyle = '#85b3c9'; c.font = '18px sans-serif'; c.fillText('JUMP & PLAY / CONNECT',34,42);
    if (stage===0) {
      c.fillStyle='#7591a7';c.font='26px sans-serif';c.fillText('Ready when you are.',160,210);
    } else if(stage===1) {
      c.strokeStyle='#5edce9';c.lineWidth=9;c.beginPath();c.moveTo(300,100);c.lineTo(370,160);c.lineTo(270,245);c.moveTo(300,100);c.lineTo(300,280);c.lineTo(370,220);c.lineTo(270,135);c.stroke();
      c.fillStyle=local>.45?'#83e7b8':'#c1d4e0';c.font='24px sans-serif';c.fillText(local>.45?'Platform connected':'Finding your platform...',200,335);
    } else {
      c.fillStyle='#dfedf3';c.font='28px sans-serif';c.fillText('Choose your game',36,95);
      const names=['Cat & Mouse','Sky Rush','Parkour Runner'];
      ['#23434c','#352d59','#29485b'].forEach((color,i)=>{c.fillStyle=color;c.fillRect(35+i*200,130,180,180);c.fillStyle=i===0?'#8be7d7':'#b9c9de';c.font='18px sans-serif';c.fillText(names[i],47+i*200,270);c.font='54px sans-serif';c.fillText(['01','02','03'][i],82+i*200,220);});
      c.fillStyle='#80e1cb';c.font='20px sans-serif';c.fillText('Launch a compatible game to begin',36,360);
    }
    laptopTexture.needsUpdate=true;
  };
  const updateLabels = stage => {
    if (stage===currentStage) return;
    currentStage=stage;host.dataset.stage=String(stage);
    stageTitle.textContent=titles[stage];stageDescription.textContent=captions[stage];stageCounter.textContent=`0${stage+1} / 06`;
    stageButtons.forEach((button,i)=>{button.classList.toggle('is-active',i===stage);button.setAttribute('aria-pressed',String(i===stage));});
    stepCards.forEach((card,i)=>{card.classList.toggle('walkthrough-active',i===stage);if(i===stage)card.setAttribute('aria-current','step');else card.removeAttribute('aria-current');});
  };
  const pose = time => {
    const stage=Math.min(5,Math.floor(time%totalDuration/stageDuration));
    const local=time%stageDuration/stageDuration;
    updateLabels(stage);progress.style.transform=`scaleX(${local})`;
    const on=stage>0||local>.35;
    powerMat.emissiveIntensity=on?1.8:.05;
    powerButton.position.y=.13-(stage===0&&local>.25&&local<.4?.013:0);
    pads.forEach(p=>{p.material.emissiveIntensity=on?.08:0;});
    kid.visible=stage>=3;
    // The child steps into the scene before the first full jump.
    const walk=stage===3?Math.min(1,local/.32):1;
    kid.position.x=-5.6+walk*3.4;
    const jumpPhase=stage===3?Math.max(0,(local-.35)/.65):local;
    const bounce=stage>=3?Math.max(0,Math.sin(jumpPhase*Math.PI*2)):0;
    const crouch=stage>=3?Math.max(0,-Math.sin(jumpPhase*Math.PI*2))*.65:0;
    kid.position.y=.22+bounce*1.05;upper.position.y=-crouch*.32;upper.rotation.x=crouch*.12;
    for(const limb of limbs){
      const x=limb.side*.23,hip=1.3-crouch*.32;
      const stride=stage===3&&walk<1?Math.sin(local*50)*.2:0;
      bone(limb.leg1,[x,hip,0],[x,.73-crouch*.1,.12+crouch*.24+stride*limb.side]);
      bone(limb.leg2,[x,.73-crouch*.1,.12+crouch*.24+stride*limb.side],[x,.22,.04]);
      const elbow=[limb.side*(.55+bounce*.15),1.72+bounce*.5,.1];
      const hand=[limb.side*(.6+bounce*.22),1.4+bounce*1.23,.17];
      bone(limb.arm1,[limb.side*.37,2.13,0],elbow);bone(limb.arm2,elbow,hand);limb.hand.position.set(...hand);
    }
    sensors.forEach((sensor,i)=>{
      sensor.visible=stage===4;
      const pulse=.5+.5*Math.sin(local*Math.PI*5-i*.45);
      sensor.scale.setScalar(.8+pulse*.8);sensor.material.emissiveIntensity=.5+pulse*1.5;
    });
    if(stage===4)pads.forEach(p=>{p.material.emissiveIntensity=.35+.25*Math.sin(local*12);});
    signalRings.forEach((ring,i)=>{
      const cycle=(local*2+i/3)%1;ring.visible=stage===1;
      ring.scale.setScalar(1+cycle*4);ring.material.opacity=stage===1?(1-cycle)*.55:0;
    });
    pairingPackets.forEach((packet,i)=>{
      packet.visible=stage===1; if(packet.visible)packet.position.copy(pairLine.getPoint((local*2+i/4)%1));
    });
    packets.forEach((packet,i)=>{
      packet.visible=stage===4||stage===5;
      if(packet.visible)packet.position.copy(path.getPoint((local*2+i/3)%1));
    });
    pressureRing.material.opacity=stage>=3?Math.max(0,Math.sin(local*Math.PI*4))*.5:0;
    pressureRing.scale.setScalar(1+(local*2%1)*2);
    if(stage<3){
      laptopScreen.material.map=laptopTexture;
      if(notebookStage!==stage||stage===1){drawNotebook(stage,local);notebookStage=stage;}
    }else{laptopScreen.material.map=texture;}
    laptopScreen.material.needsUpdate=true;
    const tick=Math.floor(time*24);
    if(tick!==gameTick){
      if(stage<2){
        ctx.fillStyle='#101f32';ctx.fillRect(0,0,960,540);ctx.fillStyle=on?'#80cdd3':'#456075';ctx.font='32px sans-serif';ctx.textAlign='center';ctx.fillText(stage===1?'BLUETOOTH CONNECTED':'JUMP & PLAY',480,250);ctx.font='20px sans-serif';ctx.fillText(stage===1?'Ready to launch a game':'Power your platform to begin',480,300);ctx.textAlign='left';texture.needsUpdate=true;
      }else drawGame(time,stage>=3?bounce:0,bounce>.05&&stage>=3);
      gameTick=tick;
    }
    desiredPosition.set(...cameraPositions[stage]);desiredTarget.set(...cameraTargets[stage]);
    if(viewport.clientWidth<600)desiredPosition.multiplyScalar(1.2);
    camera.position.lerp(desiredPosition,playing?.055:1);target.lerp(desiredTarget,playing?.055:1);camera.lookAt(target);
    status.textContent=['Power light turns on','Bluetooth pairing in progress','Choose a game on your device','Movement becomes the input','Seven FSR sensors · illustrative view','Your jump controls the game'][stage];
  };
  const render = timestamp => {
    frame=0;if(!visible||document.hidden){last=0;return;}
    if(playing&&last)elapsed+=Math.min((timestamp-last)/1000,.05);
    last=timestamp;pose(elapsed);renderer.render(scene,camera);
    if(playing)frame=requestAnimationFrame(render);
  };
  const requestRender=()=>{if(!frame&&visible&&!document.hidden)frame=requestAnimationFrame(render);};
  const seekStage=index=>{elapsed=index*stageDuration+1.8;last=0;playing=false;gameTick=-1;setButtons();requestRender();};
  stageButtons.forEach((button,i)=>button.addEventListener('click',()=>seekStage(i)));
  stepCards.forEach((card,i)=>{
    card.setAttribute('role','button');card.tabIndex=0;card.setAttribute('aria-label',`Show step ${i+1}: ${titles[i]}`);
    card.addEventListener('click',()=>seekStage(i));
    card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();seekStage(i);}});
  });
  pauseButton.addEventListener('click',()=>{playing=!playing;last=0;setButtons();requestRender();});
  replayButton.addEventListener('click',()=>{elapsed=0;last=0;playing=true;gameTick=-1;setButtons();requestRender();});
  const resize=()=>{const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<600?47:34;camera.updateProjectionMatrix();requestRender();};
  new ResizeObserver(resize).observe(viewport);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)requestRender();else{cancelAnimationFrame(frame);frame=0;last=0;}},{threshold:.08}).observe(viewport);
  document.addEventListener('visibilitychange',()=>{last=0;requestRender();});
  motion.addEventListener('change',()=>{if(motion.matches){playing=false;setButtons();requestRender();}});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(frame);frame=0;host.classList.add('experience-fallback');status.textContent='Follow the six steps below to connect and play.';});
  setButtons();pose(0);resize();host.dataset.ready='true';
})();
