// Lightweight touch input layer: a virtual joystick for movement, drag-to-
// look on the right side of the screen (tap without dragging = mine/place),
// and on-screen action buttons. Only ever activated on a detected touch
// device, from main.js's Start Journey handler -- desktop keyboard/mouse
// input (PlayerInput.js) is completely untouched by this module.

export function isTouchDevice() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
}

const JOYSTICK_RADIUS = 55;
const LOOK_SENSITIVITY = 0.0045;
const TAP_MAX_MOVE = 12;
const TAP_MAX_DURATION = 260;

export function initTouchControls(player) {
    if (!isTouchDevice()) return;
    if (document.getElementById('touch-controls')) return; // guard against double-init

    injectStyles();

    const root = document.createElement('div');
    root.id = 'touch-controls';
    document.body.appendChild(root);

    // ----- Look + tap-to-act zone (added first so joystick/buttons paint on
    // top of it and correctly receive their own taps) -----
    const lookZone = document.createElement('div');
    lookZone.className = 'tc-look-zone';
    root.appendChild(lookZone);

    let lookTouchId = null;
    let lastX = 0, lastY = 0, startTime = 0, moved = 0;

    lookZone.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0];
        lookTouchId = t.identifier;
        lastX = t.clientX;
        lastY = t.clientY;
        startTime = performance.now();
        moved = 0;
    }, { passive: true });

    lookZone.addEventListener('touchmove', (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier !== lookTouchId) continue;
            const dx = t.clientX - lastX;
            const dy = t.clientY - lastY;
            player.yaw -= dx * LOOK_SENSITIVITY;
            player.pitch -= dy * LOOK_SENSITIVITY;
            const maxPitch = Math.PI / 2 - 0.01;
            player.pitch = Math.max(-maxPitch, Math.min(maxPitch, player.pitch));
            lastX = t.clientX;
            lastY = t.clientY;
            moved += Math.abs(dx) + Math.abs(dy);
        }
    }, { passive: true });

    lookZone.addEventListener('touchend', (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier !== lookTouchId) continue;
            const duration = performance.now() - startTime;
            if (moved < TAP_MAX_MOVE && duration < TAP_MAX_DURATION) {
                if (player.handlePrimaryAction) player.handlePrimaryAction();
            }
            lookTouchId = null;
        }
    });

    // ----- Virtual joystick (movement) -----
    const joyBase = document.createElement('div');
    joyBase.className = 'tc-joystick-base';
    const joyKnob = document.createElement('div');
    joyKnob.className = 'tc-joystick-knob';
    joyBase.appendChild(joyKnob);
    root.appendChild(joyBase);

    let joyTouchId = null;
    let joyCenterX = 0, joyCenterY = 0;

    function resetJoystick() {
        joyKnob.style.transform = 'translate(-50%, -50%)';
        player.keys.forward = false;
        player.keys.backward = false;
        player.keys.left = false;
        player.keys.right = false;
    }

    joyBase.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        joyTouchId = t.identifier;
        const rect = joyBase.getBoundingClientRect();
        joyCenterX = rect.left + rect.width / 2;
        joyCenterY = rect.top + rect.height / 2;
    }, { passive: false });

    function updateJoystick(t) {
        const dx = t.clientX - joyCenterX;
        const dy = t.clientY - joyCenterY;
        const dist = Math.min(JOYSTICK_RADIUS, Math.hypot(dx, dy));
        const angle = Math.atan2(dy, dx);
        const kx = Math.cos(angle) * dist;
        const ky = Math.sin(angle) * dist;
        joyKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;

        const deadzone = JOYSTICK_RADIUS * 0.35;
        const active = dist > deadzone;
        // Maps to the same boolean WASD-style keys the existing movement
        // system already reads -- no changes needed in PlayerMovement.js.
        player.keys.forward = active && ky < -deadzone * 0.3;
        player.keys.backward = active && ky > deadzone * 0.3;
        player.keys.left = active && kx < -deadzone * 0.3;
        player.keys.right = active && kx > deadzone * 0.3;
    }

    window.addEventListener('touchmove', (e) => {
        for (const t of e.changedTouches) if (t.identifier === joyTouchId) updateJoystick(t);
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        for (const t of e.changedTouches) if (t.identifier === joyTouchId) { joyTouchId = null; resetJoystick(); }
    });
    window.addEventListener('touchcancel', (e) => {
        for (const t of e.changedTouches) if (t.identifier === joyTouchId) { joyTouchId = null; resetJoystick(); }
    });

    // ----- Action buttons -----
    const actions = document.createElement('div');
    actions.className = 'tc-actions';
    root.appendChild(actions);

    function makeBtn(label, cls, onTap) {
        const b = document.createElement('button');
        b.className = 'tc-btn ' + cls;
        b.textContent = label;
        b.addEventListener('touchstart', (e) => { e.preventDefault(); onTap(true); }, { passive: false });
        b.addEventListener('touchend', (e) => { e.preventDefault(); onTap(false); }, { passive: false });
        actions.appendChild(b);
        return b;
    }

    makeBtn('⤒', 'tc-jump', (down) => { player.keys.jump = down; });
    makeBtn('⤓', 'tc-crouch', (down) => { player.keys.crouch = down; });
    makeBtn('👁', 'tc-view', (down) => { if (down) player.viewMode = player.viewMode === 0 ? 1 : 0; });
    makeBtn('⚒', 'tc-craft', (down) => {
        if (!down || !player.quickMenu) return;
        const isOpen = player.quickMenu.classList.contains('show');
        if (isOpen) { player.quickMenu.classList.remove('show'); }
        else { if (player.updateCraftingButtons) player.updateCraftingButtons(); player.quickMenu.classList.add('show'); }
    });
}

function injectStyles() {
    if (document.getElementById('tc-styles')) return;
    const style = document.createElement('style');
    style.id = 'tc-styles';
    style.textContent = `
        #touch-controls { position: fixed; inset: 0; z-index: 40; pointer-events: none; }
        .tc-look-zone { position: absolute; right: 0; top: 0; width: 60%; height: calc(100% - 140px); pointer-events: auto; touch-action: none; }
        .tc-joystick-base { position: absolute; left: 24px; bottom: 24px; width: 120px; height: 120px; border-radius: 50%; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.25); pointer-events: auto; touch-action: none; }
        .tc-joystick-knob { position: absolute; left: 50%; top: 50%; width: 54px; height: 54px; margin-left: -27px; margin-top: -27px; border-radius: 50%; background: rgba(255,255,255,0.35); border: 2px solid rgba(255,255,255,0.5); transition: transform 0.03s linear; }
        .tc-actions { position: absolute; right: 16px; bottom: 24px; display: flex; flex-direction: column; gap: 12px; pointer-events: none; }
        .tc-btn { pointer-events: auto; width: 54px; height: 54px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.35); background: rgba(15,23,42,0.55); color: #fff; font-size: 20px; -webkit-tap-highlight-color: transparent; }
        .tc-btn:active { background: rgba(59,130,246,0.55); }
        @media (min-width: 900px) { #touch-controls { display: none; } }
    `;
    document.head.appendChild(style);
}