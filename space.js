// $KYAULabs: space.js kyau@aura.kyaulabs 2026/11/12 -0800 Exp $
/* D3 stellar field and orbital motion, behind the supplied upright N artwork. */
'use strict';

const Space = (() => {
  let timer = null, media = null, stars = null, tracks = null, system = null;
  let time = 0;
  const orbits = [
    { rx: 211, ry: 102, tilt: -32, phase: 0.5, speed: 0.00026, spin: 0.002, radius: 7, color: 'cyan' },
    { rx: 192, ry: 89, tilt: 31, phase: 3.5, speed: -0.00019, spin: -0.0015, radius: 6, color: 'violet' },
    { rx: 165, ry: 165, tilt: 0, phase: 5, speed: 0.00014, spin: 0.001, radius: 5, color: 'cyan' },
  ];

  function render(elapsed) {
    time = elapsed;
    stars.attr('transform', (_d, i) => `translate(${Math.sin(elapsed / 45000 + i) * (i + 1) * 8},${Math.cos(elapsed / 60000 + i) * (i + 1) * 5})`);
    tracks.attr('transform', (orbit) => `rotate(${orbit.tilt + elapsed * orbit.spin})`);
    tracks.select('.orbital-globe')
      .attr('cx', (orbit) => Math.cos(orbit.phase + elapsed * orbit.speed) * orbit.rx)
      .attr('cy', (orbit) => Math.sin(orbit.phase + elapsed * orbit.speed) * orbit.ry);
  }

  function syncMotion() {
    const paused = media.matches || document.hidden || document.body.classList.contains('motion-paused');
    if (paused && timer) { timer.stop(); timer = null; }
    if (!paused && !timer) {
      const baseline = time;
      let lastFrame = 0;
      timer = d3.timer((elapsed) => {
        if (elapsed - lastFrame < 33) return; // cap the SVG simulation at 30fps
        lastFrame = elapsed;
        render(baseline + elapsed);
      });
    }
  }

  function destroy() {
    if (timer) timer.stop();
    timer = null;
    if (media) media.removeEventListener('change', syncMotion);
    document.removeEventListener('ngen:motionchange', syncMotion);
    document.removeEventListener('visibilitychange', syncMotion);
    document.querySelectorAll('.space-field, .orbit-scene').forEach((el) => el.remove());
    system?.classList.remove('space-ready');
    media = stars = tracks = system = null;
    time = 0;
  }

  function init() {
    destroy();
    const background = document.querySelector('.space-background');
    system = document.querySelector('.orbital-system');
    if (!window.d3 || !background || !system) return; // original SVG remains usable

    const field = d3.select(background).append('svg').attr('class', 'space-field')
      .attr('viewBox', '0 0 1600 1000').attr('preserveAspectRatio', 'xMidYMid slice').attr('aria-hidden', 'true');
    const random = d3.randomLcg(0.427);
    stars = field.selectAll('g').data(d3.range(3)).join('g');
    stars.selectAll('circle').data(() => d3.range(54).map(() => ({
      x: random() * 1660 - 30, y: random() * 1060 - 30,
      radius: 0.4 + random() * 1.1, opacity: 0.15 + random() * 0.55,
    }))).join('circle').attr('class', 'space-star')
      .attr('cx', (star) => star.x).attr('cy', (star) => star.y)
      .attr('r', (star) => star.radius).attr('opacity', (star) => star.opacity);

    const scene = d3.select(system).append('svg').attr('class', 'orbit-scene')
      .attr('viewBox', '-240 -240 480 480').attr('aria-hidden', 'true');
    const defs = scene.append('defs');
    for (const color of ['cyan', 'violet']) {
      const globe = defs.append('radialGradient').attr('id', `space-globe-${color}`)
        .attr('cx', '30%').attr('cy', '25%').attr('r', '75%');
      globe.append('stop').attr('offset', '0%').attr('stop-color', 'var(--ngen-text)');
      globe.append('stop').attr('offset', '32%').attr('stop-color', color === 'cyan' ? 'var(--ngen-accent)' : 'var(--ngen-secondary)');
      globe.append('stop').attr('offset', '100%').attr('stop-color', 'var(--ngen-surface)');
    }
    scene.append('path').attr('d', 'M-223 0H223M0-219V219').attr('class', 'orbit-reference');
    tracks = scene.selectAll('g.orbit-track').data(orbits).join('g').attr('class', 'orbit-track');
    tracks.append('ellipse').attr('rx', (orbit) => orbit.rx).attr('ry', (orbit) => orbit.ry)
      .attr('class', (_orbit, i) => i === 2 ? 'orbit-path orbit-path-dashed' : 'orbit-path');
    tracks.append('circle').attr('class', 'orbital-globe').attr('r', (orbit) => orbit.radius)
      .attr('fill', (orbit) => `url(#space-globe-${orbit.color})`);
    system.classList.add('space-ready');
    render(0);
    media = window.matchMedia('(prefers-reduced-motion: reduce)');
    media.addEventListener('change', syncMotion);
    document.addEventListener('ngen:motionchange', syncMotion);
    document.addEventListener('visibilitychange', syncMotion);
    syncMotion();
  }
  return { init, destroy };
})();

document.addEventListener('DOMContentLoaded', () => Space.init());
// vim: ft=javascript sts=4 sw=4 ts=4 et :
