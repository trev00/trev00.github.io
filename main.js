import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(window.innerWidth, window.innerHeight);
//renderer.setClearColor(0x000000);
renderer.setPixelRatio(window.devicePixelRatio);
//renderer.shadowMap.enabled = true;
//renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, .1, 100);
camera.position.set(2,7,10);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;
controls.minDistance = 5;
controls.maxDistance = 20;
controls.minPolarAngle = 0.1;
controls.maxPolarAngle = 5;
controls.autoRotate = false;
controls.target = new THREE.Vector3(0, 3, 0);
controls.update();

/*
const groundGeometry = new THREE.PlaneGeometry(20, 20, 32, 32);
groundGeometry.rotateX(-Math.PI / 2);

const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x555555,
  side: THREE.DoubleSide
});

const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.castShadow = false;
groundMesh.receiveShadow = true;
scene.add(groundMesh);
*/

const spotLight = new THREE.SpotLight(0x404040, 15, 100, 0.22, 1);
spotLight.position.set(0, 100, 0);
spotLight.castShadow = true;
spotLight.shadow.bias = -0.0001;
scene.add(spotLight);

const ambientLight = new THREE.AmbientLight(0x404040, 20);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0x404040, 1);
scene.add(directionalLight);

const updateLightPosition = () => {
  directionalLight.position.copy(camera.position);
  directionalLight.target.position.set(0, 0, 0);
  directionalLight.target.updateMatrixWorld();
};

const loader = new GLTFLoader().setPath('3dmodels/headtubelug/');
loader.load('scene.glb', (glb) => {
  console.log('loading model');
  const mesh = glb.scene;
  mesh.scale.set(25, 25, 25);
  mesh.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      const material = child.material;
            material.metalness = .94;
    }
  });

  const boundingBox = new THREE.Box3().setFromObject(mesh);
  const center = new THREE.Vector3();
  boundingBox.getCenter(center);
  mesh.position.sub(center);
  mesh.position.setY(mesh.position.y + 3);
  scene.add(mesh);
  
  document.getElementById('progress-container').style.display = 'none';
}, (xhr) => {
  console.log(`loading ${xhr.loaded / xhr.total * 100}%`);
}, (error) => {
  console.error(error);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const animate = () => {
  requestAnimationFrame(animate);
  controls.update();
  updateLightPosition();
  renderer.render(scene, camera);
};

animate();
