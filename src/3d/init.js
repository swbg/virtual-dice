import * as CANNON from "cannon";
import * as THREE from "three";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls.js";

import woodTexture from "../assets/parquet_seamless_6833.jpg";
import diceOne from "../assets/one.svg";
import diceTwo from "../assets/two.svg";
import diceThree from "../assets/three.svg";
import diceFour from "../assets/four.svg";
import diceFive from "../assets/five.svg";
import diceSix from "../assets/six.svg";

var scene, camera, renderer, controls, groundMesh, cubeMesh, light; // THREE
var world, cubeBody, jointBody, groundBody; // CANNON
var raycaster, mouseConstraint, mousePlaneMesh; // for picking
var targetPerspectiveVector = new THREE.Vector3(0, 2, 3);
var residualPerspectiveVector = new THREE.Vector3(0, 0, 0);
var updatePerspective = true;
var wasReleased = false;
var wasPicked = false;
var setPips;

const cubeEdgeLength = 1;
const cubeMass = 4;
const controlsActive = false;
const startPosition = new THREE.Vector3(0, 5, 0);
const startQuaternion = new THREE.Vector4(0, 0, 0, 1);
const groundLength = 100;
const velocityThreshold = 0.001;

const topFace = 5;
const frontFace = 1;
const leftFace = 4;
const rightFace = 3;
const bottomFace = 2;
const backFace = 6;
const faceMapper = {
  x: { 1: rightFace, "-1": leftFace },
  y: { 1: topFace, "-1": bottomFace },
  z: { 1: frontFace, "-1": backFace },
};
const faceCubes = [];
const faceCubePips = [];

const render = () => {
  renderer.render(scene, camera);
};

const updatePhysics = () => {
  world.step(1 / 60);
  cubeMesh.position.copy(cubeBody.position);
  cubeMesh.quaternion.copy(cubeBody.quaternion);
};

const updateCamera = () => {
  residualPerspectiveVector.multiplyScalar(0.95);
  camera.position.copy(
    cubeMesh.position
      .clone()
      .add(targetPerspectiveVector)
      .add(residualPerspectiveVector)
  );
};

const animate = () => {
  requestAnimationFrame(animate);
  if (controlsActive) {
    controls.update();
  }
  updatePhysics();
  if (updatePerspective) {
    updateCamera();
  }
  if (cubeMesh.position.y < cubeEdgeLength / 4) {
    onMouseUp(null);
  }
  if (wasPicked && wasReleased && cubeStable()) {
    wasReleased = false;
    wasPicked = false;
    faceCubes.forEach((cube, index) => {
      const tmp = new THREE.Vector3();
      cube.getWorldPosition(tmp);
      if (tmp.y > cubeEdgeLength) {
        setPips(faceCubePips[index]);
      }
    });
  }
  render();
};

const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (controlsActive) {
    controls.handleResize();
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
};

const setMousePlane = (point) => {
  mousePlaneMesh.position.copy(point);
  mousePlaneMesh.quaternion.copy(camera.quaternion);
};

const getIntersectedObject = (clientX, clientY, uuid) => {
  const clickPosition = {
    x: (clientX / window.innerWidth) * 2 - 1, // only works if canvas has 100% width/height
    y: -(clientY / window.innerHeight) * 2 + 1,
  };
  raycaster.setFromCamera(clickPosition, camera);
  const intersectedObjects = raycaster.intersectObjects(scene.children);
  for (const intersectedObject of intersectedObjects) {
    if (intersectedObject.object.uuid === uuid) {
      return intersectedObject;
    }
  }
  return null;
};

const cubeStable = () => {
  return (
    cubeBody.position.y <= 0.5 &&
    cubeBody.velocity.x < velocityThreshold &&
    cubeBody.velocity.y < velocityThreshold &&
    cubeBody.velocity.z < velocityThreshold
  );
};

const onMouseDown = (e) => {
  if (!cubeStable()) {
    return; // do not allow picking while in air
  }

  const clickObject = getIntersectedObject(e.clientX, e.clientY, cubeMesh.uuid);

  if (clickObject) {
    setPips(null);
    wasPicked = true;
    updatePerspective = false;
    setMousePlane(clickObject.point);

    const v = clickObject.point.clone().sub(clickObject.object.position);
    const pivot = cubeBody.quaternion.inverse().vmult(v);

    jointBody.position.copy(clickObject.point);

    mouseConstraint = new CANNON.PointToPointConstraint(
      cubeBody,
      pivot,
      jointBody,
      new CANNON.Vec3(0, 0, 0)
    );
    world.addConstraint(mouseConstraint);
  }
};

const onMouseUp = (e) => {
  wasReleased = true;
  world.removeConstraint(mouseConstraint);
  mouseConstraint = null;
  residualPerspectiveVector.copy(
    camera.position.clone().sub(cubeMesh.position).sub(targetPerspectiveVector)
  );
  updatePerspective = true;
};

const onMouseMove = (e) => {
  if (mouseConstraint) {
    const planeObject = getIntersectedObject(
      e.clientX,
      e.clientY,
      mousePlaneMesh.uuid
    );

    if (planeObject) {
      jointBody.position.copy(planeObject.point);
      mouseConstraint.update();
    }
  }
};

const resetCube = () => {
  cubeBody.velocity.set(0, 0, 0);
  cubeBody.angularVelocity.set(0, 0, 0);
  cubeBody.position.copy(startPosition);
  cubeBody.quaternion.copy(startQuaternion);
};

const initCannon = () => {
  // World
  world = new CANNON.World();
  world.quatNormalizeSkip = 0; // normalize quaternions every step
  world.quatNormalizeFast = true; // use fast quaterinion normalization

  world.gravity.set(0, -9.82, 0);
  world.broadphase = new CANNON.NaiveBroadphase();

  // Cube
  const cubeShape = new CANNON.Box(
    new CANNON.Vec3(cubeEdgeLength / 2, cubeEdgeLength / 2, cubeEdgeLength / 2)
  );
  cubeBody = new CANNON.Body({
    mass: cubeMass,
    angularDamping: 0.8,
  });
  cubeBody.addShape(cubeShape);
  cubeBody.position.copy(startPosition);
  world.addBody(cubeBody);

  // Joint
  jointBody = new CANNON.Body({ mass: 0 });

  // Ground
  const groundShape = new CANNON.Plane();
  groundBody = new CANNON.Body({ mass: 0 });
  groundBody.addShape(groundShape);
  groundBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(1, 0, 0),
    -Math.PI / 2
  );
  world.addBody(groundBody);
};

const initThree = (setPipsFunction) => {
  // Pass useState setPips
  setPips = setPipsFunction;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcce0ff);

  // Camera
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.rotation.x = -0.7;
  scene.add(camera);

  // Raycaster
  raycaster = new THREE.Raycaster();

  // Mouse plane
  const mousePlaneGeometry = new THREE.PlaneGeometry(100, 100);
  const mousePlaneMaterial = new THREE.MeshStandardMaterial();
  mousePlaneMesh = new THREE.Mesh(mousePlaneGeometry, mousePlaneMaterial);
  mousePlaneMesh.visible = false;
  scene.add(mousePlaneMesh);

  // Cube
  const loader = new THREE.TextureLoader();

  const cubeGeometry = new THREE.BoxGeometry(
    cubeEdgeLength,
    cubeEdgeLength,
    cubeEdgeLength
  );
  const cubeMaterials = [
    new THREE.MeshStandardMaterial({ map: loader.load(diceThree) }),
    new THREE.MeshStandardMaterial({ map: loader.load(diceFour) }),
    new THREE.MeshStandardMaterial({ map: loader.load(diceFive) }),
    new THREE.MeshStandardMaterial({ map: loader.load(diceTwo) }),
    new THREE.MeshStandardMaterial({ map: loader.load(diceOne) }),
    new THREE.MeshStandardMaterial({ map: loader.load(diceSix) }),
  ];
  cubeMesh = new THREE.Mesh(cubeGeometry, cubeMaterials);
  cubeMesh.castShadow = true;
  cubeMesh.receiveShadow = true;
  scene.add(cubeMesh);

  // Indicator cubes
  for (let offset of [-1, 1]) {
    for (let axis of ["x", "y", "z"]) {
      const indicatorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.1),
        new THREE.MeshBasicMaterial()
      );
      indicatorMesh.visible = false;
      cubeMesh.add(indicatorMesh);
      cubeMesh.position.set(0, 0, 0);
      indicatorMesh.position[axis] = offset;

      faceCubes.push(indicatorMesh);
      faceCubePips.push(faceMapper[axis][offset]);
    }
  }

  // Ground
  const groundGeometry = new THREE.PlaneGeometry(groundLength, groundLength);
  const groundTexture = loader.load(woodTexture);
  groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(10, 10);
  groundTexture.anisotropy = 16;
  groundTexture.encoding = THREE.sRGBEncoding;

  const groundMaterial = new THREE.MeshStandardMaterial({ map: groundTexture });
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  groundMesh.position.copy(groundBody.position);
  groundMesh.quaternion.copy(groundBody.quaternion);
  scene.add(groundMesh);

  // Light
  scene.add(new THREE.AmbientLight(0xaaaaaa, 0.4));
  light = new THREE.DirectionalLight(0xaaaaaa, 1);
  light.castShadow = true;
  light.target = cubeMesh;
  scene.add(light);

  const d = 2;
  light.shadow.camera.left = -d;
  light.shadow.camera.right = d;
  light.shadow.camera.top = d;
  light.shadow.camera.bottom = -d;

  light.shadow.camera.near = 1;
  light.shadow.camera.far = groundLength * 4 * 2;

  light.position.set(-groundLength / 2, groundLength * 4, groundLength / 2);

  light.shadow.mapSize.width = 2048;
  light.shadow.mapSize.height = 2048;
  /*light.shadow.camera.near = 0.5;
  light.shadow.camera.far = groundLength * 4;*/

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  // Helpers
  const axesHelper = new THREE.AxesHelper(5);
  // scene.add(axesHelper);

  const cameraHelper = new THREE.CameraHelper(light.shadow.camera);
  // scene.add(cameraHelper);

  if (controlsActive) {
    controls = new TrackballControls(camera, renderer.domElement);
    // controls = new OrbitControls(camera, renderer.domElement);
    // controls.target = cubeMesh.point;
  }

  // Event handlers
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("mousemove", onMouseMove);
};

export { initCannon, initThree, animate, resetCube };
