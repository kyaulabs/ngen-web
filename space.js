// $KYAULabs: space.js kyau@aura.kyaulabs 2026/11/15 -0800 Exp $
/* Shared flowing space field, with orbital motion around the upright hero N. */
'use strict';

const Space = (() => {
  let timer = null, media = null, tracks = null, system = null;
  let time = 0, backgroundMotion = [];
  // Approximate blackbody sRGB tints, not the nebula or brand palette.
  const stellarSpectrum = {
    3000: '#ffb86d', 4000: '#ffd3a5', 5000: '#ffe6d0', 6000: '#fff3f1',
    8000: '#e3e7ff', 12000: '#c0d1ff', 20000: '#abc1ff',
  };
  const orbits = [
    { rx: 211, ry: 102, tilt: -32, phase: 0.5, speed: 0.00026, spin: 0.002, radius: 7, temperature: 12000 },
    { rx: 192, ry: 89, tilt: 31, phase: 3.5, speed: -0.00019, spin: -0.0015, radius: 6, temperature: 4000 },
    { rx: 165, ry: 165, tilt: 0, phase: 5, speed: 0.00014, spin: 0.001, radius: 5, temperature: 6000 },
  ];

  function stellarGlow(defs, prefix) {
    for (const [temperature, color] of Object.entries(stellarSpectrum)) {
      const gradient = defs.append('radialGradient').attr('id', `${prefix}-${temperature}`)
        .attr('cx', '50%').attr('cy', '50%').attr('r', '50%');
      gradient.append('stop').attr('offset', '0%').attr('stop-color', '#fff').attr('stop-opacity', 0.95);
      gradient.append('stop').attr('offset', '25%').attr('stop-color', color).attr('stop-opacity', 0.8);
      gradient.append('stop').attr('offset', '70%').attr('stop-color', color).attr('stop-opacity', 0.16);
      gradient.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0);
    }
  }

  function render(elapsed) {
    time = elapsed;
    tracks.attr('transform', (orbit) => `rotate(${orbit.tilt + elapsed * orbit.spin})`);
    tracks.selectAll('.orbital-globe, .orbital-corona')
      .attr('cx', (orbit) => Math.cos(orbit.phase + elapsed * orbit.speed) * orbit.rx)
      .attr('cy', (orbit) => Math.sin(orbit.phase + elapsed * orbit.speed) * orbit.ry);
  }

  function syncMotion() {
    const paused = media.matches || document.hidden || document.body.classList.contains('motion-paused');
    for (const animation of backgroundMotion) animation[paused ? 'pause' : 'play']();
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
    for (const animation of backgroundMotion) animation.cancel();
    backgroundMotion = [];
    if (media) media.removeEventListener('change', syncMotion);
    document.removeEventListener('ngen:motionchange', syncMotion);
    document.removeEventListener('visibilitychange', syncMotion);
    document.querySelectorAll('.space-cloud-layer, .space-star-layer, .orbit-scene').forEach((el) => el.remove());
    system?.classList.remove('space-ready');
    media = tracks = system = null;
    time = 0;
  }

  function init() {
    destroy();
    const background = document.querySelector('.space-background');
    system = document.querySelector('.orbital-system');
    if (!window.d3 || !background || !system) return; // original SVG remains usable

    const nebula = d3.select(background).append('div').attr('class', 'space-cloud-layer');
    const field = nebula.append('svg').attr('class', 'space-field')
      .attr('viewBox', '0 0 1600 1000').attr('preserveAspectRatio', 'xMidYMid slice').attr('aria-hidden', 'true');
    const random = d3.randomLcg(0.427);
    const fieldDefs = field.append('defs');
    const spectrum = fieldDefs.append('linearGradient').attr('id', 'space-nebula-spectrum')
      .attr('gradientUnits', 'userSpaceOnUse').attr('x1', 0).attr('y1', 1000).attr('x2', 1600).attr('y2', 0);
    spectrum.selectAll('stop').data([
      [0, 'blue'], [0.22, 'cyan'], [0.47, 'purple'], [0.72, 'magenta'], [1, 'pink'],
    ]).join('stop').attr('offset', ([offset]) => `${offset * 100}%`)
      .attr('stop-color', ([_offset, color]) => `var(--space-${color})`);
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
    // Color the textured density mask once, rather than repainting the same
    // large gradient for every overlapping contour at high resolutions.
    const cloudMask = fieldDefs.append('mask').attr('id', 'space-nebula-mask')
      .attr('maskUnits', 'userSpaceOnUse').attr('x', 0).attr('y', 0).attr('width', 1600).attr('height', 1000);
    cloudMask.append('g').attr('class', 'space-nebula').attr('filter', 'url(#space-cloud-texture)')
      .selectAll('path').data(clouds).join('path').attr('d', d3.geoPath())
      .attr('fill', 'white').attr('opacity', (_cloud, i) => 0.025 + (i / clouds.length) * 0.1);
    field.append('rect').attr('class', 'space-nebula-light').attr('width', 1600).attr('height', 1000)
      .attr('fill', 'url(#space-nebula-spectrum)').attr('mask', 'url(#space-nebula-mask)');
    const stars = d3.select(background).append('div').attr('class', 'space-star-layer');
    const starField = stars.append('svg').attr('class', 'space-star-field')
      .attr('viewBox', '0 0 1600 1000').attr('preserveAspectRatio', 'xMidYMid slice').attr('aria-hidden', 'true');
    const starRandom = d3.randomLcg(0.731); // independent of the approved nebula
    const temperature = d3.scaleThreshold().domain([0.05, 0.18, 0.4, 0.68, 0.86, 0.97]).range(Object.keys(stellarSpectrum));
    stellarGlow(starField.append('defs'), 'space-star-glow');
    // Apparent magnitude is logarithmic in received flux. Compress the exposure
    // for a display; radii are point-spread footprints, not stellar diameters.
    const layers = starField.selectAll('g.star-layer').data(d3.range(3).map(() => d3.range(300).map(() => {
      const magnitude = -1 + 8 * starRandom() ** 0.28;
      const flux = 10 ** (-0.4 * (magnitude + 1));
      return {
        x: starRandom() * 1660 - 30, y: starRandom() * 1060 - 30,
        radius: 0.18 + 4.2 * Math.sqrt(flux), opacity: 0.16 + 0.84 * flux ** 0.2,
        temperature: temperature(starRandom()), magnitude,
      };
    }))).join('g').attr('class', 'star-layer');
    layers.selectAll('.space-star-glow').data((points) => points.filter((star) => star.magnitude < 1.8))
      .join('circle').attr('class', 'space-star-glow').attr('fill', (star) => `url(#space-star-glow-${star.temperature})`)
      .attr('cx', (star) => star.x).attr('cy', (star) => star.y)
      .attr('r', (star) => star.radius * 5.5).attr('opacity', (star) => star.opacity);
    layers.selectAll('.space-star').data((points) => points).join('circle').attr('class', 'space-star')
      .attr('fill', (star) => stellarSpectrum[star.temperature])
      .attr('cx', (star) => star.x).attr('cy', (star) => star.y)
      .attr('r', (star) => star.radius).attr('opacity', (star) => star.opacity);
    layers.selectAll('.space-star-highlight').data((points) => points.filter((star) => star.magnitude < 1.8))
      .join('circle').attr('class', 'space-star-highlight').attr('fill', '#fff')
      .attr('cx', (star) => star.x).attr('cy', (star) => star.y)
      .attr('r', (star) => star.radius * 0.35).attr('opacity', (star) => star.opacity);

    // Let the browser move HTML layers independently of the orbital JS timer.
    if (background.animate) {
      for (const [layer, frames, duration] of [
        [stars, ['translate3d(-7%,-4%,0) scale(1.2)', 'translate3d(7%,4%,0) scale(1.2)'], 45000],
        [nebula, ['translate3d(-3%,-2%,0) rotate(-1.5deg) scale(1.15)', 'translate3d(3%,2%,0) rotate(1.5deg) scale(1.22)'], 60000],
      ]) {
        const animation = layer.node().animate(frames.map((transform) => ({ transform })), {
          duration, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out',
        });
        animation.pause();
        animation.currentTime = duration / 2; // start where drift is immediately visible
        backgroundMotion.push(animation);
      }
    }

    const scene = d3.select(system).append('svg').attr('class', 'orbit-scene')
      .attr('viewBox', '-240 -240 480 480').attr('aria-hidden', 'true');
    const defs = scene.append('defs');
    stellarGlow(defs, 'space-corona');
    scene.append('path').attr('d', 'M-223 0H223M0-219V219').attr('class', 'orbit-reference');
    tracks = scene.selectAll('g.orbit-track').data(orbits).join('g').attr('class', 'orbit-track');
    tracks.append('ellipse').attr('rx', (orbit) => orbit.rx).attr('ry', (orbit) => orbit.ry)
      .attr('class', (_orbit, i) => i === 2 ? 'orbit-path orbit-path-dashed' : 'orbit-path');
    // White-hot points and broad, fading coronas emit light rather than
    // shading a dark hemisphere like a reflective planet or metal sphere.
    tracks.append('circle').attr('class', 'orbital-corona').attr('r', (orbit) => orbit.radius * 2.8)
      .attr('fill', (orbit) => `url(#space-corona-${orbit.temperature})`);
    tracks.append('circle').attr('class', 'orbital-globe').attr('r', (orbit) => orbit.radius * 0.5)
      .attr('fill', (orbit) => d3.interpolateRgb(stellarSpectrum[orbit.temperature], '#fff')(0.8));
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
