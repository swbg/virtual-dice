import * as CANNON from "cannon";
import * as THREE from "three";

import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';


var scene, camera, renderer, controls, cubeMesh;  // THREE
var world, cubeBody;  // CANNON

const cubeEdgeLength = 0.2;

const render = () => {
  renderer.render( scene, camera );
}

const updatePhysics = () => {
  world.step(1 / 60);
  cubeMesh.position.copy(cubeBody.position);
}

const animate = () => {
  requestAnimationFrame( animate );
  controls.update();
  updatePhysics();
  render();
}

const initCannon = () => {
  // World
  world = new CANNON.World();
  world.quatNormalizeSkip = 0;  // Normalize quaternions every step
  world.quatNormalizeFast = true;  // Use fast quaterinion normalization

  world.gravity.set(0, -9.82, 0);
  world.broadphase = new CANNON.NaiveBroadphase();

  // Cube
  const mass = 3;
  const cubeShape = new CANNON.Box(new CANNON.Vec3(cubeEdgeLength / 2, cubeEdgeLength / 2, cubeEdgeLength / 2));
  cubeBody = new CANNON.Body({ mass: mass });
  cubeBody.addShape(cubeShape);
  cubeBody.position.set(0, 5, 0);
  world.addBody(cubeBody);

  // Ground
  const groundShape = new CANNON.Plane();
  const groundBody = new CANNON.Body({ mass: 0 });
  groundBody.addShape(groundShape);
  groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0),-Math.PI/2);
  world.addBody(groundBody);
};

const initThree = () => {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color( 0xcce0ff );
  scene.fog = new THREE.Fog( 0xcce0ff, 5, 10 );

  // Camera
  camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 10 );
  // camera.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI/2);
  camera.rotation.x = - 0.7;
  camera.position.set( 0, 1, 1 );

  // Cube
	const cubeGeometry = new THREE.BoxGeometry( cubeEdgeLength, cubeEdgeLength, cubeEdgeLength );
	const cubeMaterial = new THREE.MeshNormalMaterial();
  cubeMesh = new THREE.Mesh( cubeGeometry, cubeMaterial );
  cubeMesh.castShadow = true;
  cubeMesh.position.y = cubeEdgeLength / 2;
  scene.add( cubeMesh );

  // Ground
  const groundGeometry = new THREE.PlaneGeometry( 20, 20 );
  const groundMaterial = new THREE.MeshStandardMaterial( { color: 0xEEFFEE } );
  const groundMesh = new THREE.Mesh( groundGeometry, groundMaterial );
  groundMesh.rotation.x = - Math.PI / 2;
  groundMesh.receiveShadow = true;
  scene.add( groundMesh );

  // Light
  scene.add( new THREE.AmbientLight( 0x404040 ) );
  const light = new THREE.DirectionalLight( 0xdfebff, 1 );
  light.position.set( 0, 1, 1 );
  light.castShadow = true;
  light.target = groundMesh;
  scene.add( light );

  light.shadow.mapSize.width = 2048;
  light.shadow.mapSize.height = 2048;
  light.shadow.camera.near = 0.5;
  light.shadow.camera.far = 500;

  // Renderer
	renderer = new THREE.WebGLRenderer( { antialias: true } );
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.shadowMap.enabled = true;
  document.body.appendChild( renderer.domElement );
  
  // Helpers
  const axesHelper = new THREE.AxesHelper( 5 );
  scene.add( axesHelper );

  const cameraHelper = new THREE.CameraHelper( light.shadow.camera );
  scene.add( cameraHelper );

  controls = new TrackballControls( camera, renderer.domElement );
}

export { initCannon, initThree, animate };