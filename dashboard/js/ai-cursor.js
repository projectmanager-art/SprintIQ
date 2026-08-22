/**
 * AIPersonaCursor — Custom AI persona pointer + name badge
 *
 * Configurable via window.AICursorConfig before load, or pass options
 * to the constructor. Default persona: "Sophie".
 */
class AIPersonaCursor {
  constructor(options = {}) {
    this.config = Object.assign({
      personaName: 'Sophie',
      personaColor: '#e63946',
      pointerColor: '#e63946',
      showLabel: true,
      enableGlow: true,
      enableHoverEffects: true,
      enableClickAnimation: true,
      edgeMargin: 110,
      lerp: 0.18,
      idleLerp: 0.08
    }, window.AICursorConfig || {}, options);

    this.el = document.getElementById('ai-persona-cursor');
    if (!this.el) return;

    // Disable on touch/mobile devices
    if (window.matchMedia('(pointer: coarse)').matches) {
      this.el.style.display = 'none';
      return;
    }

    this.mouseX = 0;
    this.mouseY = 0;
    this.cursorX = 0;
    this.cursorY = 0;
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    this.moving = false;
    this.idleTimer = null;
    this.rippleTimer = null;

    this.badgeText = this.el.querySelector('.ai-badge-text');
    if (this.badgeText) {
      this.badgeText.textContent = this.config.showLabel ? this.config.personaName : '';
    }

    this.applyStyles();
    this.bind();
    this.start();

    this.el.style.display = 'flex';
    this.el.classList.add('idle');
  }

  applyStyles() {
    const glowAlpha = this.config.enableGlow ? '66' : '00';
    this.el.style.setProperty('--ai-persona-color', this.config.personaColor);
    this.el.style.setProperty('--ai-pointer-color', this.config.pointerColor);
    this.el.style.setProperty('--ai-pointer-glow', `${this.config.pointerColor}${glowAlpha}`);
    this.el.style.setProperty('--ai-ripple-color', `${this.config.pointerColor}99`);
    this.el.classList.toggle('no-label', !this.config.showLabel);
  }

  bind() {
    this._onMouseMove = (e) => this.onMouseMove(e);
    this._onMouseDown = () => this.onMouseDown();
    this._onMouseUp = () => this.onMouseUp();
    this._onResize = () => this.onResize();

    document.addEventListener('mousemove', this._onMouseMove, { passive: true });
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('resize', this._onResize);
  }

  onMouseMove(e) {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    this.moving = true;

    this.el.classList.remove('idle');
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.moving = false;
      this.el.classList.add('idle');
    }, 700);

    // Interactive hover state detection (pointer-events: none means e.target is below)
    if (this.config.enableHoverEffects) {
      const target = e.target.closest('a, button, input, textarea, select, [role="button"], .btn, .nav-link, .cursor-pointer');
      this.el.classList.toggle('hovering', !!target);
      const isInput = !!target && (['input', 'textarea', 'select'].includes(target.tagName.toLowerCase()) || target.classList.contains('filter-input'));
      this.el.classList.toggle('input-hover', isInput);
    }
  }

  onMouseDown() {
    if (!this.config.enableClickAnimation) return;
    this.el.classList.add('clicking');
    this.triggerRipple();
    clearTimeout(this.rippleTimer);
    this.rippleTimer = setTimeout(() => this.el.classList.remove('clicking'), 180);
  }

  onMouseUp() {
    if (!this.config.enableClickAnimation) return;
    // click class removed by ripple timer shortly after
  }

  onResize() {
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
  }

  triggerRipple() {
    const ripple = this.el.querySelector('.ai-ripple');
    if (!ripple) return;
    ripple.style.animation = 'none';
    // force reflow
    void ripple.offsetWidth;
    ripple.style.animation = '';
  }

  start() {
    const loop = () => {
      const ease = this.moving ? this.config.lerp : this.config.idleLerp;
      this.cursorX += (this.mouseX - this.cursorX) * ease;
      this.cursorY += (this.mouseY - this.cursorY) * ease;

      this.el.style.transform = `translate3d(${this.cursorX.toFixed(2)}px, ${this.cursorY.toFixed(2)}px, 0)`;

      // Viewport-edge detection for the name badge
      const nearRight = this.mouseX > this.vw - this.config.edgeMargin;
      const nearBottom = this.mouseY > this.vh - 60;
      this.el.classList.toggle('badge-left', nearRight);
      this.el.classList.toggle('badge-above', nearBottom);

      if (this.moving && Math.abs(this.mouseX - this.cursorX) < 0.5 && Math.abs(this.mouseY - this.cursorY) < 0.5) {
        this.moving = false;
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

// Auto-initialize once the cursor element is present
function initAIPersonaCursor() {
  if (document.getElementById('ai-persona-cursor')) {
    new AIPersonaCursor(window.AICursorConfig);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAIPersonaCursor);
} else {
  initAIPersonaCursor();
}
