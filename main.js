import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, .1, 100);
camera.position.set(0,2,2);
camera.lookAt(0,0,0);

const cameraControls = new OrbitControls( camera, renderer.domElement );
cameraControls.addEventListener( 'change', render );
cameraControls.update();

const groundGeometry = new THREE.PlaneGeometry(8, 8, 12, 12);
groundGeometry.rotateX(-Math.PI / 2);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x555555,
  side: THREE.DoubleSide
});
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.castShadow = false;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

const topLight = new THREE.DirectionalLight(0x404040, 3.0);
topLight.position.set(.32,.39,.7);
topLight.castShadow = true;
scene.add(topLight);

const ambientLight = new THREE.AmbientLight(0x404040, 3.0);
scene.add(ambientLight);


const axesHelper = new THREE.AxesHelper(2); // Size of 2 units
scene.add(axesHelper);


const loader = new GLTFLoader().setPath('3dmodels/headtubelug/');
loader.load('scene.glb', (glb) => {
  console.log('loading model');
  
  const mesh = glb.scene;

  mesh.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  mesh.position.set(-5, 2, 0);
  mesh.scale.set(5, 5, 5);
  scene.add(mesh);
  
  document.getElementById('progress-container').style.display = 'none';
}, (xhr) => {
  console.log(`jumping to hyperspace ${xhr.loaded / xhr.total * 100}%`);
}, (error) => {
  console.error(error);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  cameraControls.update();
  renderer.render(scene, camera);
}

animate();
