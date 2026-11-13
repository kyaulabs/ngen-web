// $KYAULabs: space.js kyau@aura.kyaulabs 2026/11/12 -0800 Exp $
/* D3 stellar field and orbital motion, behind the supplied upright N artwork. */
'use strict';

const Space = (() => {
  let timer = null, media = null, stars = null, tracks = null, system = null;
  let time = 0, lastStarFrame = -1000;
  const orbits = [
    { rx: 211, ry: 102, tilt: -32, phase: 0.5, speed: 0.00026, spin: 0.002, radius: 7, color: 'cyan' },
    { rx: 192, ry: 89, tilt: 31, phase: 3.5, speed: -0.00019, spin: -0.0015, radius: 6, color: 'violet' },
    { rx: 165, ry: 165, tilt: 0, phase: 5, speed: 0.00014, spin: 0.001, radius: 5, color: 'cyan' },
  ];

  function render(elapsed) {
    time = elapsed;
    // This sub-pixel drift is effectively unchanged between nearby frames.
    // Repaint the distant stars once per second, independently of the orbits.
    if (elapsed - lastStarFrame >= 1000) {
      stars.attr('transform', (_d, i) => `translate(${Math.sin(elapsed / 45000 + i) * (i + 1) * 8},${Math.cos(elapsed / 60000 + i) * (i + 1) * 5})`);
      lastStarFrame = elapsed;
    }
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
    document.querySelectorAll('.space-field, .space-star-field, .orbit-scene').forEach((el) => el.remove());
    system?.classList.remove('space-ready');
    media = stars = tracks = system = null;
    time = 0; lastStarFrame = -1000;
  }

  function init() {
    destroy();
    const background = document.querySelector('.space-background');
    system = document.querySelector('.orbital-system');
    if (!window.d3 || !background || !system) return; // original SVG remains usable

    const field = d3.select(background).append('svg').attr('class', 'space-field')
      .attr('viewBox', '0 0 1600 1000').attr('preserveAspectRatio', 'xMidYMid slice').attr('aria-hidden', 'true');
    const random = d3.randomLcg(0.427);
    const fieldDefs = field.append('defs');
    // Static fractal texture is separate from the moving star layers.
    const texture = fieldDefs.append('filter').attr('id', 'space-cloud-texture')
      .attr('x', '-25%').attr('y', '-25%').attr('width', '150%').attr('height', '150%');
    texture.append('feTurbulence').attr('type', 'fractalNoise').attr('baseFrequency', '0.003 0.005')
      .attr('numOctaves', 3).attr('seed', 31).attr('result', 'structure');
    texture.append('feDisplacementMap').attr('in', 'SourceGraphic').attr('in2', 'structure')
      .attr('scale', 120).attr('xChannelSelector', 'R').attr('yChannelSelector', 'G').attr('result', 'shaped');
    texture.append('feTurbulence').attr('type', 'fractalNoise').attr('baseFrequency', '0.008 0.014')
      .attr('numOctaves', 3).attr('seed', 17).attr('result', 'grain');
    texture.append('feColorMatrix').attr('in', 'grain').attr('type', 'matrix')
      .attr('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0.3 0.3 0.3 0 -0.15').attr('result', 'cloud-alpha');
    texture.append('feComposite').attr('in', 'shaped').attr('in2', 'cloud-alpha').attr('operator', 'in');
    texture.append('feGaussianBlur').attr('stdDeviation', 2.5);
    // Unequal, scattered gas concentrations produce branching contours and voids,
    // not a chain of identical ovals or a constant-width diagonal ribbon.
    const normal = d3.randomNormal.source(random)(0, 1);
    const concentrations = [
      [140, 760, 190, 120, 160], [340, 440, 110, 190, 180],
      [630, 550, 180, 115, 130], [950, 280, 170, 90, 210],
      [1270, 520, 110, 180, 150], [1510, 200, 210, 90, 190],
      [1010, 780, 160, 65, 70],
    ];
    const gas = concentrations.flatMap(([x, y, sx, sy, count]) =>
      d3.range(count).map(() => [x + normal() * sx, y + normal() * sy]));
    const clouds = d3.contourDensity().x((point) => point[0]).y((point) => point[1])
      .size([1600, 1000]).bandwidth(48).thresholds(32)(gas);
    field.append('g').attr('class', 'space-nebula').attr('filter', 'url(#space-cloud-texture)')
      .selectAll('path').data(clouds).join('path').attr('d', d3.geoPath())
      .attr('fill', (_cloud, i) => i < clouds.length * 0.75 ? 'var(--space-violet)' : 'var(--space-cyan)')
      .attr('opacity', (_cloud, i) => 0.012 + (i / clouds.length) * 0.035);
    const starField = d3.select(background).append('svg').attr('class', 'space-star-field')
      .attr('viewBox', '0 0 1600 1000').attr('preserveAspectRatio', 'xMidYMid slice').attr('aria-hidden', 'true');
    stars = starField.selectAll('g.star-layer').data(d3.range(3)).join('g').attr('class', 'star-layer');
    stars.selectAll('circle').data(() => d3.range(300).map(() => ({
      x: random() * 1660 - 30, y: random() * 1060 - 30,
      radius: 0.3 + random() ** 3 * 1.8, opacity: 0.12 + random() * 0.76,
    }))).join('circle').attr('class', 'space-star').attr('fill', 'var(--space-star)')
      .attr('cx', (star) => star.x).attr('cy', (star) => star.y)
      .attr('r', (star) => star.radius).attr('opacity', (star) => star.opacity);

    const scene = d3.select(system).append('svg').attr('class', 'orbit-scene')
      .attr('viewBox', '-240 -240 480 480').attr('aria-hidden', 'true');
    const defs = scene.append('defs');
    for (const color of ['cyan', 'violet']) {
      const globe = defs.append('radialGradient').attr('id', `space-globe-${color}`)
        .attr('cx', '30%').attr('cy', '25%').attr('r', '75%');
      globe.append('stop').attr('offset', '0%').attr('stop-color', 'var(--space-star)');
      globe.append('stop').attr('offset', '32%').attr('stop-color', `var(--space-${color})`);
      globe.append('stop').attr('offset', '100%').attr('stop-color', 'var(--space-shadow)');
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
