import * as CANNON from "cannon";
import * as THREE from "three";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls.js";

import woodTexture from "../assets/parquet_seamless_6833.jpg";
import wallpaperTexture from "../assets/plaster_seamless_6749.jpg";
import diceOne from "../assets/one.svg";
import diceTwo from "../assets/two.svg";
import diceThree from "../assets/three.svg";
import diceFour from "../assets/four.svg";
import diceFive from "../assets/five.svg";
import diceSix from "../assets/six.svg";

var scene, camera, renderer, controls, groundMesh, cubeMesh, light; // THREE
var world, cubeBody, jointBody, groundBody; // CANNON
var raycaster, mouseConstraint, mousePlaneMesh; // for picking
var targetPerspectiveVector = new THREE.Vector3(0, 2.5, 2);
var residualPerspectiveVector = new THREE.Vector3(0, 0, 0);
var updatePerspective = true;
var setPips;

const cubeEdgeLength = 1;
const cubeMass = 4;
const controlsActive = false;
const startPosition = new THREE.Vector3(0, 5, 0);
const startQuaternion = new THREE.Vector4(0, 0, 0, 1);
const groundLength = 80;
const textureAnisotropy = 16;

const trackedVelocities = {
  x: [],
  y: [],
  z: [],
}
var velocityCounter = 0;
const nVelocities = 10;
const stableVelocityThreshold = 0.001 * nVelocities;
const unstableVelocityThreshold = 1 * nVelocities;

var cannonWalls = [];

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
  trackVelocities();
  if (cubeMesh.position.y < cubeEdgeLength / 4) {
    onMouseUp(null);
  }
  if (cubeStable()) {
    faceCubes.forEach((cube, index) => {
      const tmp = new THREE.Vector3();
      cube.getWorldPosition(tmp);
      if (tmp.y > cubeEdgeLength) {
        setPips(faceCubePips[index]);
      }
    });
  } else if (cubeUnstable()) {
    setPips(null);
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

const trackVelocities = () => {
  for (let dir of ["x", "y", "z"]) {
    trackedVelocities[dir][velocityCounter] = cubeBody.velocity[dir];
  }
  velocityCounter = (velocityCounter + 1) % nVelocities;
}

const cubeStable = () => {
  return (
    cubeBody.position.y <= cubeEdgeLength &&
    trackedVelocities.x.reduce((a, b) => a + b, 0) <= stableVelocityThreshold &&
    trackedVelocities.y.reduce((a, b) => a + b, 0) <= stableVelocityThreshold &&
    trackedVelocities.z.reduce((a, b) => a + b, 0) <= stableVelocityThreshold
  );
};

const cubeUnstable = () => {
  return (
    cubeBody.position.y > cubeEdgeLength ||
    trackedVelocities.x.reduce((a, b) => a + b, 0) > unstableVelocityThreshold ||
    trackedVelocities.y.reduce((a, b) => a + b, 0) > unstableVelocityThreshold ||
    trackedVelocities.z.reduce((a, b) => a + b, 0) > unstableVelocityThreshold
  );
}

const onMouseDown = (e) => {
  if (!cubeStable()) {
    return; // do not allow picking while in air
  }

  const clickObject = getIntersectedObject(e.clientX, e.clientY, cubeMesh.uuid);

  if (clickObject) {
    setPips(null);
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

  resetCube();

  // Joint
  jointBody = new CANNON.Body({ mass: 0 });

  // Ground
  groundBody = new CANNON.Body({ mass: 0 });
  groundBody.addShape(new CANNON.Plane());
  groundBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(1, 0, 0),
    -Math.PI / 2
  );
  world.addBody(groundBody);

  // Floor
  const floorBody = new CANNON.Body({ mass: 0 });
  floorBody.addShape(new CANNON.Plane());
  floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
  floorBody.position.set(0, groundLength, 0);
  world.addBody(floorBody);

  // Walls
  const backWallBody = new CANNON.Body({ mass: 0 });
  backWallBody.addShape(new CANNON.Plane());
  backWallBody.position.set(0, 0, -groundLength / 2);
  world.addBody(backWallBody);

  const frontWallBody = new CANNON.Body({ mass: 0 });
  frontWallBody.addShape(new CANNON.Plane());
  frontWallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
  frontWallBody.position.set(0, 0, groundLength / 2);
  world.addBody(frontWallBody);

  const leftWallBody = new CANNON.Body({ mass: 0 });
  leftWallBody.addShape(new CANNON.Plane());
  leftWallBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(0, 1, 0),
    Math.PI / 2
  );
  leftWallBody.position.set(-groundLength / 2, 0, 0);
  world.addBody(leftWallBody);

  const rightWallBody = new CANNON.Body({ mass: 0 });
  rightWallBody.addShape(new CANNON.Plane());
  rightWallBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(0, 1, 0),
    -Math.PI / 2
  );
  rightWallBody.position.set(groundLength / 2, 0, 0);
  world.addBody(rightWallBody);

  cannonWalls = [backWallBody, frontWallBody, leftWallBody, rightWallBody];
};

const addThreeWall = (cannonWall, texture) => {
  const geometry = new THREE.PlaneGeometry(groundLength + 20, groundLength);
  const material = new THREE.MeshStandardMaterial({ map: texture });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.position.copy(cannonWall.position);
  mesh.position.y = groundLength / 2;
  mesh.quaternion.copy(cannonWall.quaternion);
  scene.add(mesh);
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
  const textures = [
    diceThree,
    diceFour,
    diceFive,
    diceTwo,
    diceOne,
    diceSix,
  ].map((svg) => loader.load(svg));
  for (let texture of textures) {
    texture.anisotropy = textureAnisotropy;
  }
  const cubeMaterials = textures.map(
    (texture) => new THREE.MeshStandardMaterial({ map: texture })
  );

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
  const groundGeometry = new THREE.PlaneGeometry(
    groundLength,
    groundLength + 20
  );
  const groundTexture = loader.load(woodTexture);
  groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(groundLength / 10, groundLength / 10);
  groundTexture.anisotropy = textureAnisotropy;
  groundTexture.encoding = THREE.sRGBEncoding;

  const groundMaterial = new THREE.MeshStandardMaterial({ map: groundTexture });
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.receiveShadow = true;
  groundMesh.position.copy(groundBody.position);
  groundMesh.quaternion.copy(groundBody.quaternion);
  scene.add(groundMesh);

  const wallTexture = loader.load(wallpaperTexture);
  wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
  wallTexture.repeat.set(10, 10);
  wallTexture.anisotropy = textureAnisotropy;
  wallTexture.encoding = THREE.sRGBEncoding;
  cannonWalls.forEach((wall) => addThreeWall(wall, wallTexture));

  // Light
  scene.add(new THREE.AmbientLight(0xefefef, 0.8));
  light = new THREE.DirectionalLight(0x404040, 1);
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

  light.position.set(-groundLength / 2, groundLength * 4, groundLength / 3);

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

  // Desktop
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("mousemove", onMouseMove);

  // Mobile
  window.addEventListener(
    "touchstart",
    (event) => {
      event.preventDefault();
      onMouseDown(event.touches[0]);
    },
    { passive: false }
  );
  window.addEventListener("touchend", onMouseUp);
  window.addEventListener("touchmove", (event) => {
    onMouseMove(event.touches[0]);
  });

  // Acceleration
  window.addEventListener("devicemotion", onDeviceMotion)
};

const onDeviceMotion = (e) => {
  const { x, y, z } = e.acceleration;
  const thresh = 0.1;
  const scale = 0.15;

  if (cubeBody.velocity.x * x <= thresh) {
    cubeBody.velocity.x -= x * scale;
  }
  if (cubeBody.velocity.z * z >= -thresh) {
    cubeBody.velocity.z += z * scale;
  }
  if (cubeBody.velocity.y * y <= thresh) {
    cubeBody.velocity.y -= y * scale * scale;
  }
}

export { initCannon, initThree, animate, resetCube };
