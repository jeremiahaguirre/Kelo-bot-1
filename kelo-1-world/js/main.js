// ==========================================
// ANIMATION & UI LAYER (main.js)
// ==========================================

function animateDiorama() {
  requestAnimationFrame(animateDiorama);
  const t = clock.getElapsedTime();

  // 0. Bird's-Eye View Arrow-Key / WASD Map Panning
  const panLeft = arrowKeyState.ArrowLeft || arrowKeyState.KeyA;
  const panRight = arrowKeyState.ArrowRight || arrowKeyState.KeyD;
  const panUp = arrowKeyState.ArrowUp || arrowKeyState.KeyW;
  const panDown = arrowKeyState.ArrowDown || arrowKeyState.KeyS;

  if (panLeft || panRight || panUp || panDown) {
    if (state.cameraMode !== 'bird') {
      state.cameraMode = 'bird';
      updateCameraButtonsUI();
      if (camera.position.y < 22) camera.position.y = 28;
    }
    const panSpeed = 0.52;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const moveDelta = new THREE.Vector3();
    if (panUp) moveDelta.addScaledVector(forward, panSpeed);
    if (panDown) moveDelta.addScaledVector(forward, -panSpeed);
    if (panRight) moveDelta.addScaledVector(right, panSpeed);
    if (panLeft) moveDelta.addScaledVector(right, -panSpeed);

    controls.target.add(moveDelta);
    camera.position.add(moveDelta);

    controls.target.x = Math.max(-48, Math.min(48, controls.target.x));
    controls.target.z = Math.max(-52, Math.min(28, controls.target.z));
  }

  // 1. Walk Kelo-1 smoothly to Target Location while clamping strictly ON TOP of any terrain altitude!
  const dx = state.targetPos.x - state.botPos.x;
  const dz = state.targetPos.z - state.botPos.z;
  const dist = Math.hypot(dx, dz);

  const textContext = `${state.moodTitle} ${state.speechBubble} ${state.customPlaceName || ''}`.toLowerCase();
  const isMiningOrDrilling = state.currentLocKey === 'mountain_peak' || /drill|gold|mine|auger|ore|quarry|excavat|mycelium/i.test(textContext);
  const isWeldingOrBuilding = state.currentLocKey === 'weld' || Boolean(state.proceduralMotion?.sparkBurst) || /weld|forge|titanium|track|rail|sculpt|arch|spire/i.test(textContext);

  if (keloDrillToolGroup && keloWeldTorchGroup) {
    keloDrillToolGroup.visible = isMiningOrDrilling;
    keloWeldTorchGroup.visible = !isMiningOrDrilling && isWeldingOrBuilding;
  }

  if (dist > 0.16) {
    state.isWalking = true;
    const step = dist > 14 ? 0.14 : 0.082;
    state.botPos.x += (dx / dist) * step;
    state.botPos.z += (dz / dist) * step;
    state.botRotY = Math.atan2(dx, dz);

    const groundY = getIslandGroundHeight(state.botPos.x, state.botPos.z);
    state.botAltitudeY = groundY;
    const strideHop = Math.abs(Math.sin(t * 9.5)) * 0.12;
    keloGroup.position.set(state.botPos.x, groundY + strideHop, state.botPos.z);
    keloGroup.rotation.set(0, state.botRotY, 0);
    keloLeftLeg.rotation.x = Math.sin(t * 9.5) * 0.5;
    keloRightLeg.rotation.x = -Math.sin(t * 9.5) * 0.5;
    keloLeftArm.rotation.x = -Math.sin(t * 9.5) * 0.4;
    keloRightArm.rotation.x = (isMiningOrDrilling || isWeldingOrBuilding) ? -0.65 : Math.sin(t * 9.5) * 0.4;
  } else {
    state.isWalking = false;
    const groundY = getIslandGroundHeight(state.botPos.x, state.botPos.z);
    keloGroup.position.set(state.botPos.x, groundY, state.botPos.z);
    keloLeftLeg.rotation.x = 0;
    keloRightLeg.rotation.x = 0;
    keloLeftArm.rotation.x = 0;
    keloRightArm.rotation.x = 0;
  }

  // 3. Bob Sailboat, Ogopogo, Soaring Alpine Birds
  if (emergentCreationsGroup) {
    emergentCreationsGroup.children.forEach(group => {
      group.children.forEach(mesh => {
        if (mesh.userData && mesh.userData.spin) mesh.rotation.y = t * 0.85;
      });
    });
  }

  if (sailboatGroup) {
    sailboatGroup.position.y = -0.22 + Math.sin(t * 2.2) * 0.07;
    sailboatGroup.rotation.z = Math.sin(t * 1.8) * 0.05;
  }

  // Camera Follow & Bird's-Eye Modes
  if (state.cameraMode === 'follow') {
    controls.target.lerp(new THREE.Vector3(keloGroup.position.x, keloGroup.position.y + 1.6, keloGroup.position.z), 0.08);
  } else if (state.cameraMode === 'bird') {
    const targetGroundY = getIslandGroundHeight(controls.target.x, controls.target.z);
    controls.target.y = THREE.MathUtils.lerp(controls.target.y, targetGroundY + 1.0, 0.1);
  }

  controls.update();
  renderer.render(scene, camera);
  projectLabelsToScreen();
}

function projectLabelsToScreen() {
  const viewport = document.getElementById('dioramaViewport');
  if (!viewport || !keloGroup) return;
  const w = viewport.clientWidth;
  const h = viewport.clientHeight;

  // Project Kelo-1 Overhead Bubble
  const keloHud = document.getElementById('keloOverheadHUD');
  if(keloHud) {
    const headVec = new THREE.Vector3(keloGroup.position.x, keloGroup.position.y + 3.45, keloGroup.position.z);
    headVec.project(camera);
    if (headVec.z > 1) {
      keloHud.style.opacity = '0';
    } else {
      keloHud.style.opacity = '1';
      keloHud.style.left = `${(headVec.x * 0.5 + 0.5) * w}px`;
      keloHud.style.top = `${(-(headVec.y * 0.5) + 0.5) * h}px`;
    }
  }

  // Project Building & Mountain Pins
  Object.values(TOWN_LOCATIONS).forEach(loc => {
    const el = poiDomElements[loc.id];
    if (!el) return;
    const pinBaseY = (typeof loc.groundY === 'number') ? loc.groundY : getIslandGroundHeight(loc.x, loc.z);
    const v = new THREE.Vector3(loc.x, pinBaseY + 3.6, loc.z);
    v.project(camera);
    if (v.z > 1) {
      el.style.opacity = '0';
    } else {
      el.style.opacity = '1';
      el.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
      el.style.top = `${(-(v.y * 0.5) + 0.5) * h}px`;
    }
  });
}

function renderAllUI() {
  // Update Health / HUD logic here
}
function renderChatBox() {}
function renderDiaryTab() {}
function renderRequestsTab() {}
function renderGitHubTab() {}
function renderWebTastesTab() {}

function updateCameraButtonsUI() {
  document.querySelectorAll('.cam-btn').forEach(b => {
    if (b.getAttribute('data-cam') === state.cameraMode) {
      b.className = 'cam-btn px-2.5 py-1 rounded-xl bg-amber-500/25 text-amber-300 text-[11px] font-semibold flex items-center gap-1 transition';
    } else {
      b.className = 'cam-btn px-2.5 py-1 rounded-xl hover:bg-slate-800 text-slate-300 text-[11px] font-medium flex items-center gap-1 transition';
    }
  });
}

function showToast(msg) {
  console.log("TOAST:", msg);
}

window.addEventListener('DOMContentLoaded', () => {
  if(typeof loadPersistentBrainState === 'function') loadPersistentBrainState();
  if(typeof initDiorama3D === 'function') initDiorama3D();
  renderAllUI();
  if(typeof scheduleNextOrganicImpulse === 'function') scheduleNextOrganicImpulse();
});
