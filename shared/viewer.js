import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

// Direction the camera looks from; distance is derived per model below.
const VIEW_DIR = new THREE.Vector3(0.2, 0.55, 0.85).normalize();

// Mounts an orbitable .glb into `el`. Sizes itself from the container, and only
// renders while the camera is actually moving (see wake/tick below).
// `lock` restricts interaction to rotation, holding the model at a fixed size.
export function createViewer(el, url, { lock = false } = {}) {
  // preserveDrawingBuffer keeps the last frame readable after rendering stops,
  // which is what lets the canvases appear when the page is printed to PDF.
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // outputColorSpace is left at r155's sRGB default — the colour management
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.03;
  controls.enableZoom = !lock;
  controls.enablePan = !lock;
  controls.zoomToCursor = !lock;   // wheel zooms toward the pointer

  // The x PI carries the scaling three applied internally up to r154, which
  // keeps the base numbers legible. Raised from the original 18 / 2 because
  // r155's colour management reads these colours as sRGB and converts them to
  // linear, which dropped 0x404040 to about a fifth of its old contribution.
  // The key is neutral white. It was 0xFAD6A5 (an apricot, only 65% blue),
  // inherited from main.js, and metalness .94 leaves almost no diffuse to
  // balance it, so the models reflected that tint back as gold.
  scene.add(new THREE.AmbientLight(0x404040, 32 * Math.PI));
  const key = new THREE.DirectionalLight(0xffffff, 4 * Math.PI);
  scene.add(key, key.target);

  let looping = false;

  const tick = () => {
    const moving = controls.update();
    key.position.copy(camera.position);
    renderer.render(scene, camera);

    if (!moving) {                      // that was the last frame — go to sleep
      renderer.setAnimationLoop(null);
      looping = false;
    }
  };

  const wake = () => {
    if (looping) return;
    looping = true;
    renderer.setAnimationLoop(tick);
  };

  controls.addEventListener('change', wake);

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = el;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    wake();
  };

  new ResizeObserver(resize).observe(el);
  resize();

  loader.load(url, (glb) => {
    const model = glb.scene;
    model.traverse((child) => {
      if (child.isMesh) child.material.metalness = .94;
    });

    // Frame the camera off the model's own size, so no per-model constants.
    // Centre on the bounding sphere: its radius is the same at every
    // orientation, so fitting it means no rotation can clip the model.
    const box = new THREE.Box3().setFromObject(model);
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    model.position.sub(box.getCenter(new THREE.Vector3()));
    scene.add(model);

    // Fit on whichever axis is tighter. 1.0 is an exact fit at every
    // orientation, so 1.05 is 5% of breathing room and nothing clips.
    const vFov = camera.fov * Math.PI / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const dist = 1.05 * radius / Math.sin(Math.min(vFov, hFov) / 2);

    camera.position.copy(VIEW_DIR).multiplyScalar(dist);
    camera.near = dist / 100;
    camera.far = dist * 10;
    camera.updateProjectionMatrix();
    controls.minDistance = dist * 0.4;
    controls.maxDistance = dist * 3;
    controls.update();
    controls.saveState();   // this framing is what the reset button returns to

    if (!lock) {
      const button = document.createElement('button');
      button.className = 'reset';
      button.type = 'button';
      button.textContent = 'Reset View';
      button.addEventListener('click', () => { controls.reset(); wake(); });
      el.appendChild(button);
    }

    el.classList.add('loaded');
    wake();
  }, undefined, (error) => {
    console.error(`failed to load ${url}`, error);
    el.classList.add('failed');
  });
}
