(function () {
  const mount = document.getElementById('hero-cube');
  if (!mount || typeof THREE === 'undefined') return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 13);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  mount.appendChild(renderer.domElement);

  // ---- Build the lattice: a 3x3x3 arrangement of small cubes ----
  const GRID = 3;
  const SPACING = 2.35;
  const CUBE_SIZE = 1.55;

  const group = new THREE.Group();
  const cubes = [];

  const violet = new THREE.Color(0x7c5cff);
  const teal = new THREE.Color(0x2fe0c4);
  const white = new THREE.Color(0xeef1ff);

  const geo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
  const edgesGeo = new THREE.EdgesGeometry(geo);

  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      for (let z = 0; z < GRID; z++) {
        const target = new THREE.Vector3(
          (x - (GRID - 1) / 2) * SPACING,
          (y - (GRID - 1) / 2) * SPACING,
          (z - (GRID - 1) / 2) * SPACING
        );

        // color by distance from center: core = white, mid = violet, outer = teal
        const dist = target.length();
        const t = THREE.MathUtils.clamp(dist / 4.2, 0, 1);
        let color;
        if (t < 0.5) color = violet.clone().lerp(white, 1 - t * 2);
        else color = violet.clone().lerp(teal, (t - 0.5) * 2);

        const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
        const wire = new THREE.LineSegments(edgesGeo, lineMat);

        const faceMat = new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: 0.035, depthWrite: false
        });
        const face = new THREE.Mesh(geo, faceMat);

        const cubeObj = new THREE.Group();
        cubeObj.add(face);
        cubeObj.add(wire);

        // start scattered + rotated randomly (pre-assembly state)
        const scatterRadius = 9 + Math.random() * 6;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        cubeObj.position.set(
          scatterRadius * Math.sin(phi) * Math.cos(theta),
          scatterRadius * Math.sin(phi) * Math.sin(theta),
          scatterRadius * Math.cos(phi)
        );
        cubeObj.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

        cubeObj.userData.target = target;
        cubeObj.userData.spinSpeed = new THREE.Vector3(
          (Math.random() - 0.5) * 0.004,
          (Math.random() - 0.5) * 0.004,
          (Math.random() - 0.5) * 0.004
        );
        cubeObj.userData.floatSeed = Math.random() * Math.PI * 2;
        cubeObj.userData.floatOffset = target.clone();

        group.add(cubeObj);
        cubes.push(cubeObj);
      }
    }
  }
  scene.add(group);

  // gentle key light glow via a point-light-less approach (unlit materials only, kept simple/performant)

  // ---- Assembly animation ----
  const start = performance.now();
  const ASSEMBLE_MS = 2200;

  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

  // ---- Pointer parallax ----
  let targetRotX = 0, targetRotY = 0;
  window.addEventListener('mousemove', (e) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    targetRotY = nx * 0.35;
    targetRotX = ny * 0.2;
  }, { passive: true });

  // ---- Scroll dispersal ----
  let scrollFactor = 0;
  function updateScroll() {
    const heroH = mount.closest('.hero') ? mount.closest('.hero').offsetHeight : window.innerHeight;
    scrollFactor = THREE.MathUtils.clamp(window.scrollY / (heroH * 0.9), 0, 1);
  }
  window.addEventListener('scroll', updateScroll, { passive: true });
  updateScroll();

  function resize() {
    const w = mount.clientWidth, h = mount.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize, { passive: true });

  function animate(now) {
    const elapsed = now - start;
    const assembleT = easeOutCubic(THREE.MathUtils.clamp(elapsed / ASSEMBLE_MS, 0, 1));

    cubes.forEach((c) => {
      const target = c.userData.target;
      const disperse = target.clone().multiplyScalar(1 + scrollFactor * 1.9);
      const finalPos = target.clone().lerp(disperse, 1); // reuse target as base

      // blend from scatter start (implicit via current position) toward assembled+dispersed target
      c.position.lerp(
        new THREE.Vector3(
          finalPos.x,
          finalPos.y + Math.sin(now * 0.0006 + c.userData.floatSeed) * 0.12,
          finalPos.z
        ),
        prefersReduced ? 1 : 0.045 + assembleT * 0.02
      );

      if (!prefersReduced) {
        c.rotation.x += c.userData.spinSpeed.x;
        c.rotation.y += c.userData.spinSpeed.y;
      }

      const mats = c.children;
      mats.forEach((m) => {
        if (m.material.opacity !== undefined) {
          const base = m.geometry.type === 'EdgesGeometry' ? 0.85 : 0.035;
          m.material.opacity = base * assembleT * (1 - scrollFactor * 0.7);
        }
      });
    });

    group.rotation.y += prefersReduced ? 0 : 0.0009;
    group.rotation.x += (targetRotX - group.rotation.x) * 0.03;
    group.rotation.y += (targetRotY * 0.15);

    renderer.render(scene, camera);
    if (!prefersReduced || elapsed < ASSEMBLE_MS + 100) requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
})();
