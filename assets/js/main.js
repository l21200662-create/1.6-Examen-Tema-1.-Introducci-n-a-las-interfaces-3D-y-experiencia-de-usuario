import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const $ = (id) => document.getElementById(id);
const ui = {
  canvas: $('scene'), loading: $('loading'), start: $('startScreen'), pause: $('pauseScreen'), end: $('endScreen'),
  hud: $('hud'), topbar: $('topbar'), healthBar: $('healthBar'), healthText: $('healthText'), status: $('statusText'),
  timer: $('timer'), enemyCount: $('enemyCount'), objective: $('objectiveTitle'), objectiveSub: $('objectiveSub'),
  objectiveStep: $('objectiveStep'), sampleProgress: $('sampleProgress'), hint: $('interactHint'), toast: $('toast'),
  power: $('power'), powerValue: $('powerValue'), crosshair: $('crosshair'), error: $('errorToast'), levelBadge: $('levelBadge'),
};
const LEVELS = [
  { title: 'Despertar', objective: 'Recupera la muestra y encuentra la salida', samples: [[-15,-5]], enemies: [[15,-2]], enemyHealth: 1, enemySpeed: .86, timeLimit: 150, theme: 'lab', background: 0x101b18, atmosphere: 0x9df1c7, floor: 0x43544a },
  { title: 'Cultivos inestables', objective: 'Recupera 2 muestras bajo presión', samples: [[-15,-7],[15,-7]], enemies: [[-15,3],[14,-2],[0,-13]], enemyHealth: 2, enemySpeed: 1.06, timeLimit: 135, theme: 'cryo', background: 0x0b1924, atmosphere: 0x77d9ed, floor: 0x294552 },
  { title: 'Zona de cuarentena', objective: 'Asegura 3 muestras y evita a los infectados', samples: [[-15,-9],[14,-8],[0,1]], enemies: [[-15,3],[14,-2],[0,-13],[15,10],[-15,-12]], enemyHealth: 2, enemySpeed: 1.24, timeLimit: 120, theme: 'quarantine', background: 0x241211, atmosphere: 0xff765f, floor: 0x51312c },
  { title: 'Extracción final', objective: 'Recupera 4 muestras, sobrevive y alcanza el elevador', samples: [[-15,-9],[15,-9],[-15,7],[15,7]], enemies: [[-15,3],[14,-2],[0,-13],[15,10],[-15,-12],[7,8],[-7,-3]], enemyHealth: 3, enemySpeed: 1.42, timeLimit: 105, theme: 'reactor', background: 0x0d1b23, atmosphere: 0x8ce8ff, floor: 0x243a48 },
];
const CHARACTERS = [
  { name: 'EVA-07', role: 'Especialista de contención', initial: '07', suit: '#d8d8c5', accent: '#c8ee68', dark: '#28352f', visor: '#243b3c', silhouette: 'scout' },
  { name: 'GUARDIA-12', role: 'Seguridad de la estación', initial: '12', suit: '#8ea4ba', accent: '#f3a25d', dark: '#263647', visor: '#1e3345', silhouette: 'guard' },
  { name: 'BIO-03', role: 'Técnica de laboratorio', initial: '03', suit: '#92c8b6', accent: '#ff8e9b', dark: '#29433f', visor: '#213e42', silhouette: 'scientist' },
];
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101b18);
scene.fog = new THREE.FogExp2(0x101b18, 0.021);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 120);
const renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

const clock = new THREE.Clock();
const keys = new Set();
const raycaster = new THREE.Raycaster();
const up = new THREE.Vector3(0, 1, 0);
let world, player, playerBody, playerCollider;
let cameraYaw = 0, cameraPitch = 0.2, cameraDistance = 6.6;
let moveYaw = null;
let initialized = false, state = 'loading', elapsed = 0, levelTimeRemaining = 0, health = 100, collected = 0;
let power = 13, enemies = [], samples = [], props = [], projectiles = [], particles = [], exitDoor;
let lastInteract = 0, animState = 'Idle', playerSpeed = 0, lastShot = 0, attackAnimTimer = 0;
let levelIndex = 0, characterIndex = 0;
const solidBoxes = [];
const cameraOccluders = [];
let levelScene = null;
const levelBodies = [], levelSolids = [], levelOccluders = [], levelHazards = [];
const levelOwnedResources = [];
let pointerLocked = false, mouseDragging = false, dragCameraMoved = false, lastMouseX = 0, lastMouseY = 0, messageTimer = 0;
let audioContext = null, lastFootstep = 0;

const mats = {};
function mat(name, color, roughness = .8, metalness = 0, extra = {}) {
  mats[name] = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  return mats[name];
}
mat('wall', 0x64716a); mat('wallDark', 0x37453e); mat('floor', 0x43544a); mat('floorLight', 0x64725f);
mat('metal', 0x809087, .34, .68); mat('darkMetal', 0x28352f, .4, .65); mat('glass', 0x8ee7c8, .22, .12, { emissive: 0x164738, emissiveIntensity: .55, transparent: true, opacity: .58 });
mat('acid', 0xc8ee68, .35, .1, { emissive: 0x547817, emissiveIntensity: .45 }); mat('blue', 0x67b9d3, .32, .2, { emissive: 0x123547, emissiveIntensity: .35 });
mat('white', 0xd4d7c5); mat('orange', 0xd87945); mat('red', 0xf06d54, .4, .1, { emissive: 0x65170c, emissiveIntensity: .6 });
mat('enemySkin', 0x647e5c, .9); mat('enemyDark', 0x354437, .75); mat('playerSuit', 0xd8d8c5, .65); mat('visor', 0x243b3c, .24, .28);

function addBoxVisual(parent, x, y, z, sx, sy, sz, material, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y, z);
  if (opts.cast !== false) mesh.castShadow = true;
  mesh.receiveShadow = opts.receive !== false;
  parent.add(mesh);
  return mesh;
}
function addCylinderVisual(parent, x, y, z, rt, rb, h, material, segments = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), material);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function makePhysBox(name, pos, half, material, dynamic = false, density = 1, rotY = 0) {
  const desc = dynamic ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.fixed();
  desc.setTranslation(...pos); if (rotY) desc.setRotation({ x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) });
  const body = world.createRigidBody(desc);
  const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(...half).setFriction(.82).setRestitution(.08).setDensity(density), body);
  const mesh = addBoxVisual(scene, 0, 0, 0, half[0] * 2, half[1] * 2, half[2] * 2, material);
  mesh.position.set(...pos); mesh.rotation.y = rotY;
  cameraOccluders.push(mesh);
  props.push({ name, body, mesh, dynamic, original: [...pos], resetRot: rotY, collider });
  return { body, collider, mesh };
}
function addFixedBox(pos, half, material, rotY = 0) {
  const d = RAPIER.RigidBodyDesc.fixed().setTranslation(...pos);
  if (rotY) d.setRotation({ x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) });
  const b = world.createRigidBody(d);
  world.createCollider(RAPIER.ColliderDesc.cuboid(...half).setFriction(.9), b);
  const mesh = addBoxVisual(scene, ...pos, half[0]*2, half[1]*2, half[2]*2, material);
  mesh.rotation.y = rotY;
  cameraOccluders.push(mesh);
  if (half[1] > .18 && pos[1] + half[1] > .18 && pos[1] - half[1] < 1.8) {
    const c=Math.abs(Math.cos(rotY)),s=Math.abs(Math.sin(rotY));
    solidBoxes.push({x:pos[0],z:pos[2],hx:half[0]*c+half[2]*s,hz:half[0]*s+half[2]*c,low:pos[1]-half[1],high:pos[1]+half[1]});
  }
  return b;
}
function addLight(color, intensity, pos, distance = 0, angle = Math.PI / 5) {
  const light = new THREE.SpotLight(color, intensity, distance, angle, .52, 1.7);
  light.position.set(...pos); light.target.position.set(pos[0], 0, pos[2]); light.castShadow = false;
  scene.add(light, light.target); return light;
}

function buildRoom() {
  const floorGeo = new THREE.PlaneGeometry(42, 32, 1, 1);
  const floor = new THREE.Mesh(floorGeo, mats.floor); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  addFixedBox([0, -.12, 0], [21, .12, 16], mats.floor);
  // Modular floor lanes and luminous hazard strips define the navigable lab.
  for (let x = -18; x <= 18; x += 3) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(.025, .012, 30), mats.darkMetal); strip.position.set(x, .014, 0); scene.add(strip);
  }
  for (let z = -13; z <= 13; z += 3) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(40, .012, .025), mats.darkMetal); strip.position.set(0, .016, z); scene.add(strip);
  }
  const wallH = 5.5;
  addFixedBox([0, wallH / 2, -16], [21, wallH / 2, .35], mats.wallDark);
  addFixedBox([-21, wallH / 2, 0], [.35, wallH / 2, 16], mats.wallDark);
  addFixedBox([21, wallH / 2, 0], [.35, wallH / 2, 16], mats.wallDark);
  // Front wall has the extraction bay opening at center.
  addFixedBox([-14, wallH / 2, 16], [7, wallH / 2, .35], mats.wallDark);
  addFixedBox([14, wallH / 2, 16], [7, wallH / 2, .35], mats.wallDark);
  addFixedBox([0, 4.5, 16], [7, 1, .35], mats.wallDark);
  for (let x = -18; x <= 18; x += 6) {
    const pillar = addBoxVisual(scene, x, 2.6, -15.5, .4, 5.2, .5, mats.metal); pillar.castShadow = true;
    addBoxVisual(scene, x, 5.26, -15.5, .48, .13, .57, mats.acid);
    addBoxVisual(scene, x, 2.6, 15.5, .4, 5.2, .5, mats.metal);
  }
  // Upper wall trim, recessed panels and glass observation windows.
  for (let side of [-1, 1]) {
    for (let z = -12; z <= 12; z += 4) {
      addBoxVisual(scene, side * 20.62, 3.5, z, .08, 1.65, 2.4, mats.wall);
      addBoxVisual(scene, side * 20.55, 3.55, z, .09, .96, 1.55, mats.glass);
      addBoxVisual(scene, side * 20.47, 2.96, z, .06, .08, 1.7, mats.acid);
    }
  }
  for (let x = -12; x <= 12; x += 6) {
    addBoxVisual(scene, x, 4.7, -15.6, 3.6, 1.25, .12, mats.glass);
    addBoxVisual(scene, x, 4.02, -15.48, 3.75, .09, .18, mats.metal);
  }
  // Ceiling ribs frame the arena without closing the camera view.
  for (let z = -14; z <= 14; z += 4) addBoxVisual(scene, 0, 5.25, z, 41, .16, .18, mats.darkMetal);
  // Lab stations: solid work benches and observation islands.
  const counters = [
    [-14, -8, 3.6, 1.3], [14, -9, 3.8, 1.3], [-13, 5, 4.2, 1.2], [14, 6, 3.4, 1.3],
  ];
  for (const [x,z,sx,sz] of counters) {
    addFixedBox([x, 1.05, z], [sx / 2, .18, sz / 2], mats.metal);
    for (const dx of [-sx*.38, sx*.38]) for (const dz of [-sz*.34, sz*.34]) addFixedBox([x+dx,.52,z+dz],[.09,.52,.09],mats.darkMetal);
    addBoxVisual(scene,x,1.25,z,sx*.28,.05,.13,mats.blue);
  }
  // Room labels and door frame.
  for (let x of [-7.3, 7.3]) addBoxVisual(scene, x, 2.65, 15.56, .2, 4.6, .35, mats.metal);
  addBoxVisual(scene, 0, 4.95, 15.55, 14.8, .2, .4, mats.acid);
  const exitGroup = new THREE.Group(); exitGroup.position.set(0, 0, 15.55); scene.add(exitGroup);
  addBoxVisual(exitGroup,0,2.1,0,13.5,4.1,.18,mats.darkMetal);
  const door = addBoxVisual(exitGroup,0,2.08,.14,12.2,3.82,.16,mats.red);
  door.material = mats.glass.clone(); door.material.emissive = new THREE.Color(0x5a2118); door.material.emissiveIntensity = .75;
  for (let x of [-6.1,6.1]) addBoxVisual(exitGroup,x,2.08,.28,.08,3.8,.12,mats.acid);
  exitDoor = { group: exitGroup, mesh: door, open: false };
  // Extraction floor chevrons.
  for (let i=-3;i<=3;i++) { const line=addBoxVisual(scene,i*1.3,.025,12.8,.82,.018,.055,mats.acid,{cast:false}); line.rotation.y=.45; }
  // Work islands / partitions, each with static collision.
  const walls = [
    [-7, 1.5, -7, .3, 1.5, 5], [7, 1.5, -7, .3, 1.5, 5],
    [-7, 1.5, 5.7, .3, 1.5, 4], [7, 1.5, 5.7, .3, 1.5, 4],
    [-2.6, 1.5, -10.7, 3.5, 1.5, .28], [2.6, 1.5, -10.7, 3.5, 1.5, .28],
    [-2.6, 1.5, 9.3, 3.5, 1.5, .28], [2.6, 1.5, 9.3, 3.5, 1.5, .28],
  ];
  for (const [x,y,z,sx,sy,sz] of walls) {
    addFixedBox([x,y,z],[sx,sy,sz],mats.wall);
    addBoxVisual(scene,x,y+sy,z,sx*2,.08,sz*2,mats.metal);
    addBoxVisual(scene,x,y+sy+.07,z,sx*2,.045,.07,mats.acid);
  }
  // Fixed lab machinery communicates scale and helps break up long sight lines.
  for (const [x,z] of [[-17,-2],[17,-2],[-17,10],[17,10]]) {
    addFixedBox([x,1,z],[1,.9,1],mats.darkMetal);
    addBoxVisual(scene,x,1.2,z,1.65,.7,1.4,mats.wall);
    addBoxVisual(scene,x,1.25,z-.72,.72,.36,.04,mats.blue);
    addCylinderVisual(scene,x,2.05,z,.18,.18,.18,mats.acid,12);
  }
  // Fluorescent ceiling fixtures and pools of colored light.
  for (let x of [-14,-7,0,7,14]) for (let z of [-12,0,12]) {
    const fixture = addBoxVisual(scene,x,5.13,z,2.1,.075,.18,mats.white,{cast:false});
    fixture.material = new THREE.MeshStandardMaterial({color:0xe7f6de,emissive:0xc4eac1,emissiveIntensity:1.5,roughness:.3});
    const light = new THREE.PointLight(z===0?0x9df1c7:0xd3ebda, 20, 10, 2); light.position.set(x,4.85,z); scene.add(light);
  }
  const rim = new THREE.HemisphereLight(0xb5d5bf,0x19231f,1.15); scene.add(rim);
  const key = new THREE.DirectionalLight(0xe6efdf,2.0); key.position.set(-8,15,10); key.castShadow=true; key.shadow.mapSize.set(1024,1024); key.shadow.camera.left=-24; key.shadow.camera.right=24; key.shadow.camera.top=22; key.shadow.camera.bottom=-22; key.shadow.bias=-.001; scene.add(key);
  addLight(0x69efbd,7,[-10,4.5,-1],12); addLight(0x78bfe2,6,[10,4.5,0],12); addLight(0xd0ee83,5,[0,4.5,12],10);
}

function clearLevelScenario() {
  for (const body of levelBodies) world.removeRigidBody(body);
  for (const box of levelSolids) { const index = solidBoxes.indexOf(box); if (index >= 0) solidBoxes.splice(index, 1); }
  for (const mesh of levelOccluders) { const index = cameraOccluders.indexOf(mesh); if (index >= 0) cameraOccluders.splice(index, 1); }
  if (levelScene) { levelScene.traverse(node=>{if(node.isMesh)node.geometry.dispose();});scene.remove(levelScene); }
  for(const resource of levelOwnedResources)resource.dispose();
  levelScene = null; levelBodies.length = 0; levelSolids.length = 0; levelOccluders.length = 0; levelHazards.length = 0; levelOwnedResources.length = 0;
}

function addScenarioObstacle(pos, half, material, accent = mats.acid) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(pos[0], pos[1], pos[2]));
  world.createCollider(RAPIER.ColliderDesc.cuboid(half[0], half[1], half[2]).setFriction(.9), body);
  const mesh = addBoxVisual(levelScene, ...pos, half[0] * 2, half[1] * 2, half[2] * 2, material);
  levelBodies.push(body); levelOccluders.push(mesh); cameraOccluders.push(mesh);
  const solid = { x:pos[0], z:pos[2], hx:half[0], hz:half[2], low:pos[1]-half[1], high:pos[1]+half[1] };
  levelSolids.push(solid); solidBoxes.push(solid);
  addBoxVisual(levelScene, pos[0], pos[1] + half[1] + .055, pos[2], half[0] * 2, .08, half[2] * 2, accent);
}

function addScenarioTank(x, z, height, color) {
  const tank = new THREE.Group(); tank.position.set(x, 0, z); levelScene.add(tank);
  const shell = new THREE.MeshStandardMaterial({ color, roughness:.27, metalness:.48, emissive:color, emissiveIntensity:.2, transparent:true, opacity:.78 });
  levelOwnedResources.push(shell);
  addCylinderVisual(tank, 0, height / 2, 0, .56, .56, height, shell, 20);
  addCylinderVisual(tank, 0, height + .12, 0, .68, .68, .2, mats.darkMetal, 20);
  addCylinderVisual(tank, 0, .12, 0, .68, .68, .2, mats.metal, 20);
  const coreGeometry=new THREE.CylinderGeometry(.17, .17, height * .72, 12),coreMaterial=new THREE.MeshBasicMaterial({ color });
  levelOwnedResources.push(coreMaterial);
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  core.position.y = height * .55; tank.add(core);
  for (const y of [.45, height * .52, height - .25]) addCylinderVisual(tank, 0, y, 0, .7, .7, .055, mats.acid, 20);
}

function addHazard(x, z, radius, color, damage) {
  const group = new THREE.Group(); group.position.set(x, .035, z); levelScene.add(group);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), new THREE.MeshBasicMaterial({ color, transparent:true, opacity:.22, depthWrite:false }));
  pool.rotation.x = -Math.PI / 2; group.add(pool);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * .78, .045, 7, 48), new THREE.MeshBasicMaterial({ color, transparent:true, opacity:.85 }));
  ring.rotation.x = Math.PI / 2; group.add(ring);
  levelOwnedResources.push(pool.material,ring.material);
  levelHazards.push({ x, z, radius, damage, cooldown:0, group, phase:Math.random() * Math.PI * 2 });
}

function buildLevelScenario(level) {
  clearLevelScenario(); levelScene = new THREE.Group(); scene.add(levelScene);
  mats.floor.color.set(level.floor);
  const floorTint = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshBasicMaterial({ color:level.atmosphere, transparent:true, opacity:.075, depthWrite:false }));
  floorTint.rotation.x = -Math.PI / 2; floorTint.position.y = .025; levelScene.add(floorTint);
  levelOwnedResources.push(floorTint.material);

  if (level.theme === 'cryo') {
    for (const x of [-17, 17]) for (const z of [-10, 0, 10]) addScenarioTank(x, z, 3.15, 0x63d6ed);
    addScenarioObstacle([-10.5, .9, -1], [2.2, .9, .35], mats.blue, mats.glass);
    addScenarioObstacle([10.5, .9, 4], [2.2, .9, .35], mats.blue, mats.glass);
    for (const x of [-14, 14]) { const light = new THREE.PointLight(0x53d8ff, 35, 12, 2); light.position.set(x, 3.2, -2); levelScene.add(light); }
  } else if (level.theme === 'quarantine') {
    for (const [x,z,rot] of [[-12,-1,.12],[12,2,-.12],[-2,-8,Math.PI/2],[4,7,Math.PI/2]]) {
      const barrier = addBoxVisual(levelScene, x, 1.42, z, 3.6, 1.42, .13, mats.glass); barrier.rotation.y = rot;
      const rail = addBoxVisual(levelScene, x, 2.94, z, 3.7, .08, .2, mats.red); rail.rotation.y = rot;
    }
    addScenarioObstacle([-10.5, .92, -5], [1.3, .92, .55], mats.red, mats.orange);
    addScenarioObstacle([10.5, .92, 8], [1.3, .92, .55], mats.red, mats.orange);
    addScenarioTank(18, -12, 3.45, 0xff6658);
    addHazard(-12, 6, 1.55, 0xe85745, 7); addHazard(12, -7, 1.55, 0xe85745, 7);
    const alarm = new THREE.PointLight(0xff4433, 48, 18, 2); alarm.position.set(0, 4.5, 0); levelScene.add(alarm);
  } else if (level.theme === 'reactor') {
    addScenarioTank(0, -3, 4.1, 0x55ddff);
    for (const [x,z] of [[-17,-2],[17,-2],[-17,9],[17,9]]) {
      addScenarioTank(x, z, 2.4, 0xff8b4a);
      addBoxVisual(levelScene, x, .045, z, 2.35, .04, 2.35, mats.orange);
    }
    addScenarioObstacle([-8, .95, -2], [2.1, .95, .48], mats.darkMetal, mats.orange);
    addScenarioObstacle([8, .95, 3], [2.1, .95, .48], mats.darkMetal, mats.orange);
    addScenarioObstacle([0, .72, 8], [3.2, .72, .45], mats.metal, mats.blue);
    addHazard(-12, -4, 1.65, 0xff692e, 9); addHazard(12, 0, 1.65, 0xff692e, 9); addHazard(0, 5, 1.5, 0xff692e, 9);
    const coreLight = new THREE.PointLight(0x55ddff, 55, 20, 2); coreLight.position.set(0, 3.2, -3); levelScene.add(coreLight);
  }
}

function createPlayer() {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, .98, 11));
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(.48, .31).setFriction(.1), body);
  player = { body, collider, target: new THREE.Vector3(0,.98,11), velocity: new THREE.Vector3(), facing: 0, invuln: 0, group: null, fallback: null, avatarLimbs: { arms:[], legs:[] } };
  playerBody = body; playerCollider = collider;
  buildFallbackAvatar();
  applyCharacterAppearance();
}
function applyCharacterAppearance() {
  const profile=CHARACTERS[characterIndex];
  const portrait=$('characterPortrait');
  if(portrait){portrait.style.setProperty('--character-accent',profile.accent);portrait.style.setProperty('--character-suit',profile.suit);}
  if($('characterInitial'))$('characterInitial').textContent=profile.initial;
  if($('characterName'))$('characterName').textContent=profile.name;
  if($('characterRole'))$('characterRole').textContent=profile.role;
  $('characterDots')?.querySelectorAll('i').forEach((dot,i)=>dot.classList.toggle('selected',i===characterIndex));
  if(player?.fallbackMats){player.fallbackMats.suit.color.set(profile.suit);player.fallbackMats.accent.color.set(profile.accent);player.fallbackMats.accent.emissive.set(profile.accent);player.fallbackMats.dark.color.set(profile.dark);player.fallbackMats.visor.color.set(profile.visor);}
}
function buildFallbackAvatar() {
  if (player.group) {
    player.fallback?.traverse(node => { if (node.isMesh) node.geometry.dispose(); });
    if(player.fallbackMats)Object.values(player.fallbackMats).forEach(material=>material.dispose());
    scene.remove(player.group);
  }
  const group = new THREE.Group(); group.position.set(player.target.x,0,player.target.z); scene.add(group); player.group = group;
  const root = new THREE.Group(); group.add(root); player.fallback = root;
  const profile=CHARACTERS[characterIndex],suit=mats.playerSuit.clone(),accent=mats.acid.clone(),dark=mats.darkMetal.clone(),visorMat=mats.visor.clone(),metal=mats.metal.clone();
  suit.color.set(profile.suit);accent.color.set(profile.accent);accent.emissive.set(profile.accent);dark.color.set(profile.dark);visorMat.color.set(profile.visor);
  player.fallbackMats={suit,accent,dark,visor:visorMat};
  const width=profile.silhouette==='guard'?1.22:profile.silhouette==='scientist'?1.08:1;
  const torso=addCylinderVisual(root,0,.88,0,.31*width,.28*width,.72,suit,12); torso.rotation.z=Math.PI;
  addCylinderVisual(root,0,1.23,0,.24*width,.24*width,.1,dark,12);
  const head = new THREE.Mesh(new THREE.SphereGeometry(profile.silhouette==='guard'?.28:.25,16,12),suit); head.position.set(0,1.53,0); head.scale.set(profile.silhouette==='scientist'?1.12:1,profile.silhouette==='guard'?.92:1.06,1); head.castShadow=true; root.add(head);
  addBoxVisual(root,0,1.54,.22,.35,.14,.07,visorMat);
  addBoxVisual(root,0,.94,-.32,profile.silhouette==='guard'?.52:.42,.48,.23,dark);
  addBoxVisual(root,0,.98,-.445,.27,.12,.03,accent);
  player.avatarLimbs={arms:[],legs:[]};
  for (const side of [-1,1]) {
    const shoulder=new THREE.Group(); shoulder.position.set(side*.34,1.13,0); root.add(shoulder); player.avatarLimbs.arms.push(shoulder);
    const arm=addCylinderVisual(shoulder,0,-.24,0,.13,.115,.5,suit,10); arm.rotation.z=-side*.08;
    addCylinderVisual(shoulder,0,-.52,.02,.095,.095,.12,metal,10);
    addBoxVisual(shoulder,0,-.59,.08,.17,.13,.18,dark);
    addBoxVisual(root,side*.37,1.17,0,profile.silhouette==='guard'?.25:.17,.2,.28,profile.silhouette==='guard'?dark:suit);
    const leg=new THREE.Group(); leg.position.set(side*.15,.58,0); root.add(leg); player.avatarLimbs.legs.push(leg);
    addCylinderVisual(leg,0,-.25,0,.105,.13,.47,suit,10);
    addBoxVisual(leg,0,-.51,.1,.21,.11,.33,dark);
  }
  // Silhouette and equipment distinguish the three selectable operators.
  if(profile.silhouette==='scout'){
    addBoxVisual(root,0,1.02,-.52,.35,.4,.17,dark);
    for(const side of [-1,1]){addCylinderVisual(root,side*.23,.99,-.53,.075,.075,.34,accent,10);addBoxVisual(root,side*.31,1.08,0,.04,.22,.045,accent);}
    addCylinderVisual(root,0,1.83,0,.08,.08,.18,metal,10);
  }else if(profile.silhouette==='guard'){
    addBoxVisual(root,0,1.07,.27,.43,.29,.13,dark);
    addBoxVisual(root,0,1.08,.35,.22,.08,.035,accent);
    addBoxVisual(root,0,1.82,-.02,.24,.08,.22,metal);
    addBoxVisual(root,.28,.83,.02,.14,.28,.17,accent);
  }else{
    addBoxVisual(root,0,.57,.04,.48,.17,.39,suit);
    addBoxVisual(root,-.26,.87,-.03,.19,.29,.19,accent);
    addBoxVisual(root,.25,.94,.17,.2,.28,.13,dark);
    for(let i=0;i<3;i++)addCylinderVisual(root,.25,.87+i*.09,.25,.035,.035,.07,i===1?mats.blue:accent,8);
    addCylinderVisual(root,0,1.79,0,.3,.3,.08,suit,16);
  }
  // The right forearm carries the ion emitter used by the player.
  const weapon=addBoxVisual(player.avatarLimbs.arms[1],.13,-.39,.2,.15,.16,.45,dark);
  weapon.rotation.x=-.12;
  addBoxVisual(player.avatarLimbs.arms[1],.13,-.39,.43,.1,.1,.08,accent);
}

function buildPhysicsObjects() {
  // Four distinct prop types, including dynamic crates and a knock-down specimen rack.
  const crateMat = new THREE.MeshStandardMaterial({color:0x9b6845,roughness:.78});
  for (const [x,z] of [[-4,-4],[-3.15,-4],[4.2,-7],[5,-7],[-15,10]]) {
    const { mesh }=makePhysBox('crate',[x,.48,z],[.46,.46,.46],crateMat,true,1.2);
    addBoxVisual(mesh,0,0,.465,.58,.58,.025,mats.orange,{cast:false});
    addBoxVisual(mesh,0,0,.49,.31,.035,.012,mats.darkMetal,{cast:false});
  }
  // Metal drums use dynamic cylinders and are pushable by movement / blasts.
  for (const [x,z,color] of [[-11,0,mats.blue],[11,-3,mats.orange],[11,10,mats.acid],[-11,9,mats.red]]) {
    const rb=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,.62,z).setCanSleep(true));
    world.createCollider(RAPIER.ColliderDesc.cylinder(.57,.39).setFriction(.68).setRestitution(.12).setDensity(.8),rb);
    const mesh=addCylinderVisual(scene,x,.62,z,.39,.39,1.14,color,20); props.push({name:'drum',body:rb,mesh,dynamic:true,original:[x,.62,z],resetRot:0,cylinder:true});
    addCylinderVisual(mesh,0,.58,0,.28,.28,.025,mats.metal,20);
    addBoxVisual(mesh,0,-.25,.395,.25,.08,.015,mats.darkMetal,{cast:false});
  }
  // A rack of sample vials can be knocked over; each vial is an independent rigid body.
  addFixedBox([-2, .5, -1], [1.35,.1,.5],mats.metal);
  const vialColors=[mats.red,mats.blue,mats.acid,mats.glass];
  for(let i=0;i<4;i++){
    const x=-2.85+i*.57;
    const rb=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,1.07,-1));
    world.createCollider(RAPIER.ColliderDesc.cylinder(.25,.12,.115).setFriction(.5).setRestitution(.22).setDensity(.5),rb);
    const g=new THREE.Group(); scene.add(g); const glass=addCylinderVisual(g,0,0,0,.12,.12,.5,vialColors[i],12); glass.rotation.z=Math.PI/2;
    addCylinderVisual(g,.17,0,0,.13,.13,.08,mats.darkMetal,12).rotation.z=Math.PI/2;
    props.push({name:'vial',body:rb,mesh:g,dynamic:true,original:[x,1.07,-1],resetRot:0});
  }
  // Other fixed prop silhouettes: monitor plinths and utility cases.
  for(const [x,z] of [[-11,-9],[11,-10],[-11,6],[11,6]]){
    addFixedBox([x,.48,z],[.52,.48,.52],mats.darkMetal);
    const screen=addBoxVisual(scene,x,1.26,z-.43,.62,.33,.035,mats.blue);
    screen.material = new THREE.MeshStandardMaterial({color:0x4eacc1,emissive:0x174753,emissiveIntensity:.7,roughness:.3});
    addBoxVisual(scene,x,1.48,z-.43,.4,.025,.05,mats.acid);
  }
  // Dynamic barricade stack is a clearly visible derribable structure.
  const stack = [[0, .48,-5.1],[.92,.48,-5.1],[-.92,.48,-5.1],[0,1.42,-5.1]];
  stack.forEach((p,i)=>makePhysBox('derribable',[p[0],p[1],p[2]],[.44,.44,.42],i===3?mats.orange:crateMat,true,1.35));
}

function makeEnemyVisual(variantIndex = 0) {
  const variant = variantIndex % 3;
  const palettes = [
    { skin:0x647e5c, armor:0x354437, glow:0xf06d54, scale:1 },
    { skin:0x826064, armor:0x392e3c, glow:0xd44979, scale:1.12 },
    { skin:0x677688, armor:0x2c3948, glow:0x77dfff, scale:.92 },
  ];
  const palette=palettes[variant],skin=new THREE.MeshStandardMaterial({color:palette.skin,roughness:.9}),armor=new THREE.MeshStandardMaterial({color:palette.armor,roughness:.76}),glow=new THREE.MeshStandardMaterial({color:palette.glow,emissive:palette.glow,emissiveIntensity:.6,roughness:.4});
  const group = new THREE.Group();
  const torso=addCylinderVisual(group,0,.9,0,.34,.42,.85,armor,12); torso.rotation.z=-.14;
  const chest=addCylinderVisual(group,0,1.02,.02,.27,.3,.47,skin,12); chest.rotation.z=-.14;
  const head=new THREE.Mesh(new THREE.SphereGeometry(.27,14,12),skin); head.position.set(0,1.52,.05); head.castShadow=true; group.add(head);
  addBoxVisual(group,0,1.38,.24,.31,.1,.12,glow);
  for(const s of [-1,1]){
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.05,8,8),glow); eye.position.set(s*.12,1.54,.28); group.add(eye);
    const arm=addCylinderVisual(group,s*.4,.86,0,.12,.14,.72,skin,9); arm.rotation.z=s*.18;
    addCylinderVisual(group,s*.14,.27,.01,.13,.14,.52,armor,9);
  }
  group.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  group.scale.setScalar(palette.scale);
  return group;
}
function spawnEnemy(x,z,index,level=currentLevel()) {
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x,1,z));
  const collider=world.createCollider(RAPIER.ColliderDesc.capsule(.53,.25).setFriction(.1),body);
  const group=makeEnemyVisual(index+levelIndex); group.position.set(x,0,z); scene.add(group);
  const enemy={body,collider,group,position:new THREE.Vector3(x,1,z),home:new THREE.Vector3(x,1,z),health:level.enemyHealth,speed:level.enemySpeed+index*.065,attackCooldown:.35+index*.18,stagger:0,knockback:new THREE.Vector3(),alive:true,bodyRemoved:false,id:index+1,phase:index*1.8,hitFlash:0,walkPhase:index};
  enemies.push(enemy);
  // Procedural glow puddle under each enemy highlights the threat.
  const aura=new THREE.Mesh(new THREE.CircleGeometry(.63,24),new THREE.MeshBasicMaterial({color:0xd14932,transparent:true,opacity:.16,depthWrite:false}));
  aura.rotation.x=-Math.PI/2;aura.position.set(x,.028,z);scene.add(aura);enemy.aura=aura;
}

function spawnSamples(locations=currentLevel().samples) {
  for (const [index,p] of locations.entries()) {
    const group=new THREE.Group(); group.position.set(p[0],0,p[1]); scene.add(group);
    const halo=new THREE.Mesh(new THREE.TorusGeometry(.48,.025,6,36),mats.acid); halo.rotation.x=Math.PI/2;halo.position.y=.08;group.add(halo);
    const pod=addCylinderVisual(group,0,.72,0,.21,.21,.62,mats.glass,16);
    addCylinderVisual(group,0,1.04,0,.24,.24,.1,mats.darkMetal,16);
    addCylinderVisual(group,0,.4,0,.24,.24,.09,mats.darkMetal,16);
    addCylinderVisual(group,0,.7,0,.09,.09,.38,index===1?mats.red:(index===2?mats.blue:mats.acid),12);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.22,.46,1.8,16,1,true),new THREE.MeshBasicMaterial({color:0xb6f67a,transparent:true,opacity:.08,side:THREE.DoubleSide,depthWrite:false}));
    beam.position.y=.95;group.add(beam);
    const spr=new THREE.Sprite(new THREE.SpriteMaterial({color:0xc8ee68,transparent:true,opacity:.9}));
    spr.position.y=1.5;spr.scale.set(.19,.19,1);group.add(spr);
    samples.push({group,position:new THREE.Vector3(p[0],0,p[1]),collected:false,index,pod,beam});
  }
}
function playSound(kind) {
  try {
    const AudioEngine=window.AudioContext||window.webkitAudioContext;
    if(!AudioEngine)return;
    if(!audioContext)audioContext=new AudioEngine();
    if(audioContext.state==='suspended')audioContext.resume();
    const sounds={
      shot:{start:620,end:150,duration:.16,type:'sawtooth',volume:.12},
      impact:{start:190,end:65,duration:.12,type:'square',volume:.09},
      hurt:{start:120,end:48,duration:.28,type:'triangle',volume:.13},
      step:{start:95,end:48,duration:.065,type:'sine',volume:.035},
      sample:{start:460,end:980,duration:.3,type:'sine',volume:.09},
      level:{start:300,end:760,duration:.52,type:'triangle',volume:.1},
      timeout:{start:260,end:110,duration:.58,type:'sawtooth',volume:.13},
    };
    const sound=sounds[kind];if(!sound)return;
    const now=audioContext.currentTime,osc=audioContext.createOscillator(),gain=audioContext.createGain();
    osc.type=sound.type;osc.frequency.setValueAtTime(sound.start,now);osc.frequency.exponentialRampToValueAtTime(sound.end,now+sound.duration);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(sound.volume,now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+sound.duration);
    osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+sound.duration+.02);
  } catch { /* Sound stays optional when a browser blocks audio. */ }
}
function updateSampleVisuals(t) {
  for(const s of samples){if(s.collected)continue;s.group.position.y=.055+Math.sin(t*1.8+s.index)*.045;s.group.rotation.y=t*.32+s.index;}
}
function updateHazards(dt) {
  for(const hazard of levelHazards){
    hazard.cooldown=Math.max(0,hazard.cooldown-dt);hazard.phase+=dt;hazard.group.rotation.y+=dt*.18;
    hazard.group.children[0].material.opacity=.16+Math.sin(hazard.phase*2)*.06;
    const dx=player.group.position.x-hazard.x,dz=player.group.position.z-hazard.z;
    if(dx*dx+dz*dz<(hazard.radius*.78)**2&&hazard.cooldown===0){hazard.cooldown=1.1;damagePlayer(hazard.damage);}
  }
}

function createProjectile(origin, direction) {
  const radius=.17;
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(origin.x,origin.y,origin.z).setLinvel(direction.x*power,direction.y*power,direction.z*power).setCcdEnabled(true).setCanSleep(false));
  world.createCollider(RAPIER.ColliderDesc.ball(radius).setRestitution(.82).setFriction(.16).setDensity(.25),body);
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,12,10),new THREE.MeshBasicMaterial({color:0xd8ff83}));mesh.castShadow=true;scene.add(mesh);
  const glow=new THREE.PointLight(0xbaff67,2.2,3,2);mesh.add(glow);
  const trail=new THREE.Mesh(new THREE.SphereGeometry(radius*.55,8,6),new THREE.MeshBasicMaterial({color:0x8ef1c8,transparent:true,opacity:.55}));trail.position.z=-.27;mesh.add(trail);
  projectiles.push({body,mesh,life:2.5,hit:new Set(),radius});
  for(const enemy of enemies){ if(!enemy.alive) continue; const d=enemy.position.distanceTo(origin); if(d<3.6){const away=enemy.position.clone().sub(origin).setY(0).normalize();const impulse=away.multiplyScalar(power*(1-d/4)*.7);enemy.body.setLinvel({x:impulse.x,y:2.4,z:impulse.z},true);enemy.stagger=.65;} }
  ui.crosshair.classList.add('firing');setTimeout(()=>ui.crosshair.classList.remove('firing'),100);
}

function fire() {
  if(state!=='playing'||performance.now()-lastShot<320)return;
  lastShot=performance.now();
  attackAnimTimer=.34;
  const direction=new THREE.Vector3(Math.sin(cameraYaw)*Math.cos(cameraPitch),Math.sin(cameraPitch),Math.cos(cameraYaw)*Math.cos(cameraPitch)).normalize();
  const origin=player.group.position.clone().add(new THREE.Vector3(0,1.35,0)).addScaledVector(direction,.68);
  createProjectile(origin,direction);
  player.facing=cameraYaw;player.group.rotation.y=player.facing;playSound('shot');
}
function addBurst(position,color=0xc8ee68,count=14) {
  for(let i=0;i<count;i++){
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(.035+Math.random()*.045,5,4),new THREE.MeshBasicMaterial({color,transparent:true,opacity:1}));
    mesh.position.copy(position);scene.add(mesh);
    const velocity=new THREE.Vector3((Math.random()-.5)*3,Math.random()*3,(Math.random()-.5)*3);
    particles.push({mesh,velocity,life:.45+Math.random()*.4,maxLife:.85});
  }
}

function updateProjectiles(dt) {
  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i],pos=p.body.translation();p.mesh.position.set(pos.x,pos.y,pos.z);p.life-=dt;
    if(p.life<0||pos.y<-.5){removeProjectile(i);continue;}
    for(const enemy of enemies){
      if(!enemy.alive||p.hit.has(enemy))continue;
      if(enemy.position.distanceTo(p.mesh.position)<.78){
        p.hit.add(enemy);enemy.health--;enemy.stagger=.42;
        playSound('impact');
        const dir=enemy.position.clone().sub(p.mesh.position).setY(0).normalize();
        enemy.knockback.addScaledVector(dir,Math.min(3.4,power*.22));
        addBurst(enemy.position.clone().add(new THREE.Vector3(0,1,0)),0xc8ee68,11);
        if(enemy.health<=0){enemy.alive=false;enemy.bodyRemoved=true;scene.remove(enemy.group);scene.remove(enemy.aura);world.removeRigidBody(enemy.body);toast('AMENAZA CONTENIDA');updateHUD();}
        removeProjectile(i);break;
      }
    }
  }
}
function removeProjectile(index){const p=projectiles[index];if(!p)return;scene.remove(p.mesh);world.removeRigidBody(p.body);projectiles.splice(index,1);}
function updateParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.mesh.position.addScaledVector(p.velocity,dt);p.velocity.y-=4*dt;p.mesh.material.opacity=Math.max(0,p.life/p.maxLife);if(p.life<=0){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();particles.splice(i,1);}}}

function updatePhysics(dt) {
  world.timestep=dt;
  world.step();
  const tr=player.body.translation();
  player.group.position.set(tr.x,tr.y-.98,tr.z);
  // Keep the capsule controller inside the arena and on its floor.
  player.target.set(tr.x,tr.y,tr.z);
  for(const p of props){if(!p.dynamic)continue;const t=p.body.translation(),r=p.body.rotation();p.mesh.position.set(t.x,t.y,t.z);p.mesh.quaternion.set(r.x,r.y,r.z,r.w);}
  for(const e of enemies){if(!e.alive)continue;const t=e.body.translation();e.position.set(t.x,t.y,t.z);e.group.position.set(t.x,t.y-1+Math.sin(e.walkPhase)*.035,t.z);const r=e.body.rotation();e.group.quaternion.set(r.x,r.y,r.z,r.w);if(e.stagger>0)e.stagger-=dt;}
}

function smoothPlayerInput(dt) {
  const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
  // Jocelin's requested layout: A moves right and D moves left.
  const lateral=(keys.has('KeyA')||keys.has('ArrowRight')?1:0)-(keys.has('KeyD')||keys.has('ArrowLeft')?1:0);
  const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight');
  const moving=forward!==0||lateral!==0;
  const speed=sprint?6.4:3.35;
  const desired=new THREE.Vector3();
  const inputYaw=moveYaw===null?cameraYaw:moveYaw;
  const camForward=new THREE.Vector3(Math.sin(inputYaw),0,Math.cos(inputYaw));
  const camRight=new THREE.Vector3(Math.cos(inputYaw),0,-Math.sin(inputYaw));
  desired.addScaledVector(camForward,forward).addScaledVector(camRight,lateral);
  if(desired.lengthSq()>1)desired.normalize();
  desired.multiplyScalar(moving?speed:0);
  player.velocity.x=THREE.MathUtils.damp(player.velocity.x,desired.x,12,dt);
  player.velocity.z=THREE.MathUtils.damp(player.velocity.z,desired.z,12,dt);
  playerSpeed=Math.hypot(player.velocity.x,player.velocity.z);
  let nx=player.target.x+player.velocity.x*dt,nz=player.target.z+player.velocity.z*dt;
  nx=THREE.MathUtils.clamp(nx,-19.7,19.7);nz=THREE.MathUtils.clamp(nz,-14.7,14.7);
  // Resolve against fixed collider boxes and slide along the blocked axis.
  const prevX=player.target.x,prevZ=player.target.z, radius=.39;
  const overlaps=(x,z,b)=>x>b.x-b.hx-radius&&x<b.x+b.hx+radius&&z>b.z-b.hz-radius&&z<b.z+b.hz+radius;
  for(const b of solidBoxes){
    if(b.high<.18||b.low>1.78||!overlaps(nx,nz,b))continue;
    const canX=!overlaps(nx,prevZ,b),canZ=!overlaps(prevX,nz,b);
    if(canX&&!canZ)nz=prevZ;
    else if(canZ&&!canX)nx=prevX;
    else if(canX&&canZ){if(Math.abs(nx-prevX)>Math.abs(nz-prevZ))nz=prevZ;else nx=prevX;}
    else {nx=prevX;nz=prevZ;}
  }
  const cur=player.body.translation();
  player.body.setNextKinematicTranslation({x:nx,y:.98,z:nz});
  player.target.set(nx,.98,nz);
  if(playerSpeed>.15){
    const face=Math.atan2(player.velocity.x,player.velocity.z);
    player.facing=THREE.MathUtils.dampAngle(player.facing,face,12,dt);
    cameraYaw=THREE.MathUtils.dampAngle(cameraYaw,player.facing,2.1,dt);
  }
  player.group.rotation.y=player.facing;
  attackAnimTimer=Math.max(0,attackAnimTimer-dt);
  const nextAnim=attackAnimTimer>0?'Attack':playerSpeed<.2?'Idle':sprint&&playerSpeed>3.8?'Run':'Walk';
  setAnimation(nextAnim);
  const gait=playerSpeed>.16?elapsed*(sprint?13:8):0;
  for(let i=0;i<player.avatarLimbs.legs.length;i++)player.avatarLimbs.legs[i].rotation.x=playerSpeed>.16?Math.sin(gait+i*Math.PI)*.46:THREE.MathUtils.damp(player.avatarLimbs.legs[i].rotation.x,0,8,dt);
  for(let i=0;i<player.avatarLimbs.arms.length;i++){
    const arm=player.avatarLimbs.arms[i],swing=playerSpeed>.16?Math.sin(gait+i*Math.PI+Math.PI)*.28:0;
    arm.rotation.x=THREE.MathUtils.damp(arm.rotation.x,(i===1&&attackAnimTimer>0?-.8:swing),12,dt);
  }
  if(playerSpeed>.5){const stepInterval=sprint ? .29 : .45;if(elapsed-lastFootstep>stepInterval){playSound('step');lastFootstep=elapsed;}}
}

function setAnimation(name){
  animState=name;
}
function updateEnemies(dt){
  for(const e of enemies){if(!e.alive)continue;e.phase+=dt;const delta=player.group.position.clone().sub(e.position);delta.y=0;const dist=delta.length();
    if(e.stagger>0){e.stagger=Math.max(0,e.stagger-dt);e.attackCooldown=Math.max(e.attackCooldown,.4);const x=e.position.x+e.knockback.x*dt,z=e.position.z+e.knockback.z*dt;e.body.setNextKinematicTranslation({x,y:1,z});e.knockback.multiplyScalar(Math.exp(-5*dt));continue;}
    if(dist>.98){delta.normalize();const speed=e.speed*(dist<3?1.23:1);let x=e.position.x+delta.x*speed*dt,z=e.position.z+delta.z*speed*dt;
      const blocked=(px,pz)=>solidBoxes.some(b=>b.high>.18&&b.low<1.78&&px>b.x-b.hx-.35&&px<b.x+b.hx+.35&&pz>b.z-b.hz-.35&&pz<b.z+b.hz+.35);
      if(blocked(x,z)){if(!blocked(x,e.position.z))z=e.position.z;else if(!blocked(e.position.x,z))x=e.position.x;else{x=e.position.x;z=e.position.z;}}
      e.body.setNextKinematicTranslation({x,y:1,z});const facing=Math.atan2(delta.x,delta.z);e.body.setNextKinematicRotation({x:0,y:Math.sin(facing/2),z:0,w:Math.cos(facing/2)});e.walkPhase+=dt*speed*5;e.group.position.y=Math.sin(e.walkPhase)*.035;
    }
    e.attackCooldown-=dt;
    if(dist<1.42&&e.attackCooldown<=0){e.attackCooldown=1.05;damagePlayer(9+Math.random()*5);}
  }
}
function damagePlayer(amount){if(player.invuln>0)return;player.invuln=.55;health=Math.max(0,health-amount);playSound('hurt');updateHUD();addBurst(player.group.position.clone().add(new THREE.Vector3(0,1,0)),0xf06d54,8);if(health<=0)finish(false,'La integridad del traje llegó a cero.');}

function updateCamera(dt){
  const focus=player.group.position.clone().add(new THREE.Vector3(0,1.45,0));
  const horizontal=Math.cos(cameraPitch)*cameraDistance;
  const desired=focus.clone().add(new THREE.Vector3(-Math.sin(cameraYaw)*horizontal,Math.sin(cameraPitch)*cameraDistance+1.15,-Math.cos(cameraYaw)*horizontal));
  // Short raycast keeps camera outside nearby walls.
  const dir=desired.clone().sub(focus);const length=dir.length();dir.normalize();
  raycaster.set(focus,dir);raycaster.camera=camera;raycaster.far=length;
  const hits=raycaster.intersectObjects(cameraOccluders,false);
  let target=desired;if(hits.length)target=focus.clone().addScaledVector(dir,Math.max(1.5,hits[0].distance-.25));
  camera.position.lerp(target,1-Math.exp(-8*dt));camera.lookAt(focus);
}

function updateInteract(){
  let nearest=null,min=2.2;
  for(const s of samples){if(s.collected)continue;const d=player.group.position.distanceTo(new THREE.Vector3(s.position.x,0,s.position.z));if(d<min){min=d;nearest=s;}}
  ui.hint.classList.toggle('active',!!nearest&&state==='playing');ui.hint.querySelector('span').textContent=nearest?'EXTRAER MUESTRA':'EXTRAER MUESTRA';
  return nearest;
}
function currentLevel(){return LEVELS[levelIndex];}
function interact(){
  if(state!=='playing')return;
  const required=currentLevel().samples.length,sample=updateInteract();
  if(sample){
    sample.collected=true;sample.group.visible=false;collected++;
    addBurst(new THREE.Vector3(sample.position.x,.8,sample.position.z),0xc8ee68,18);playSound('sample');
    toast(`MUESTRA ${String(collected).padStart(2,'0')} / ${String(required).padStart(2,'0')} ASEGURADA`);updateHUD();
    if(collected===required){exitDoor.open=true;exitDoor.mesh.material.emissive=new THREE.Color(0x183d21);exitDoor.mesh.material.emissiveIntensity=.75;exitDoor.mesh.material.color.set(0x79b779);toast('SALIDA DESBLOQUEADA · ALCANZA EL ELEVADOR');}
  }else if(collected===required&&player.group.position.z>12.8&&Math.abs(player.group.position.x)<6.2)completeLevel();
  else if(performance.now()-lastInteract>700){lastInteract=performance.now();toast(collected<required?'ACÉRCATE A UNA MUESTRA PARA EXTRAERLA':'DIRÍGETE AL ELEVADOR DE SALIDA');}
}

function updateHUD(){
  const h=Math.ceil(health),required=currentLevel().samples.length;
  ui.healthBar.style.width=`${h}%`;ui.healthText.textContent=`${h}%`;
  ui.healthBar.style.background=h<32?'#f06d54':h<60?'#e6bd67':'#8ef1c8';
  ui.status.textContent=h<32?'CRÍTICO':h<60?'INESTABLE':'ESTABLE';
  ui.enemyCount.textContent=String(enemies.filter(e=>e.alive).length).padStart(2,'0');
  ui.sampleProgress.style.width=`${collected/required*100}%`;
  ui.levelBadge.textContent=`NIVEL ${String(levelIndex+1).padStart(2,'0')} / 04`;
  ui.objective.textContent=collected<required?`Nivel ${levelIndex+1}: ${currentLevel().title}`:'Alcanza el elevador';
  ui.objectiveSub.textContent=collected<required?`${currentLevel().objective} · ${required-collected} ${required-collected===1?'muestra':'muestras'} restantes`:'Salida desbloqueada · llega al elevador';
  ui.objectiveStep.textContent=`NIVEL ${String(levelIndex+1).padStart(2,'0')} / 04`;
  ui.timer.textContent=formatTime(levelTimeRemaining);
  ui.timer.classList.toggle('timer-warning',levelTimeRemaining<=30);
  ui.powerValue.textContent=String(power);
}
function toast(text){ui.toast.textContent=text;ui.toast.style.opacity='1';messageTimer=2.2;}
function showError(text){ui.error.textContent=text;ui.error.classList.add('visible');setTimeout(()=>ui.error.classList.remove('visible'),3400);}

function showHUD(show){ui.hud.classList.toggle('hud-hidden',!show);ui.topbar.classList.toggle('hud-hidden',!show);}
function startGame(){
  resetGame();state='playing';ui.start.classList.add('hidden');ui.pause.classList.add('hidden');ui.end.classList.add('hidden');$('continueBtn').classList.add('hidden');$('restartBtn').classList.remove('hidden');showHUD(true);clock.getDelta();playSound('level');
}
function pauseGame(){if(state==='playing'){state='paused';ui.pause.classList.remove('hidden');showHUD(false);}else if(state==='paused'){state='playing';ui.pause.classList.add('hidden');showHUD(true);clock.getDelta();}}
function presentEnd(title,message,canContinue){
  showHUD(false);ui.end.classList.remove('hidden');
  $('endKicker').innerHTML=`<span></span>${canContinue?'REPORTE DE NIVEL':'REPORTE DE MISIÓN'}`;$('endTitle').innerHTML=title;$('endMessage').textContent=message;
  $('finalTime').textContent=formatTime(elapsed);$('finalSamples').textContent=`${String(collected).padStart(2,'0')} / ${String(currentLevel().samples.length).padStart(2,'0')}`;$('finalEnemies').textContent=String(enemies.filter(e=>e.alive).length).padStart(2,'0');
  $('continueBtn').classList.toggle('hidden',!canContinue);$('restartBtn').classList.toggle('hidden',canContinue);
}
function finish(win,message){if(state!=='playing')return;state=win?'won':'lost';presentEnd(win?'MISIÓN<br>COMPLETADA':'MISIÓN<br>FALLIDA',message,false);}
function completeLevel(){
  if(state!=='playing')return;
  if(levelIndex===LEVELS.length-1){playSound('level');finish(true,'Completaste los cuatro niveles. Las muestras están aseguradas.');return;}
  state='levelComplete';playSound('level');presentEnd(`NIVEL ${levelIndex+1}<br>COMPLETADO`,`${currentLevel().title} asegurado. Prepárate para el siguiente escenario.`,true);
}
function formatTime(seconds){const s=Math.floor(seconds);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function setupLevel(index){
  levelIndex=index;
  for(const e of enemies){if(!e.bodyRemoved)world.removeRigidBody(e.body);scene.remove(e.group);scene.remove(e.aura);}enemies.length=0;
  for(const s of samples)scene.remove(s.group);samples.length=0;
  for(const p of [...projectiles])removeProjectile(projectiles.indexOf(p));
  const config=currentLevel();buildLevelScenario(config);scene.background.set(config.background);scene.fog.color.set(config.background);scene.fog.density=config.theme==='cryo'?.027:config.theme==='quarantine'?.03:.021;for(const light of scene.children){if(light.isPointLight)light.color.set(config.atmosphere);}
  levelTimeRemaining=config.timeLimit;health=100;collected=0;player.invuln=0;player.velocity.set(0,0,0);player.target.set(0,.98,11);player.body.setNextKinematicTranslation({x:0,y:.98,z:11});player.group.position.set(0,0,11);player.group.rotation.set(0,0,0);player.facing=0;
  for(const p of props){p.body.setTranslation({x:p.original[0],y:p.original[1],z:p.original[2]},true);p.body.setLinvel({x:0,y:0,z:0},true);p.body.setAngvel({x:0,y:0,z:0},true);const a=p.resetRot||0;p.body.setRotation({x:0,y:Math.sin(a/2),z:0,w:Math.cos(a/2)},true);p.mesh.position.set(p.original[0],p.original[1],p.original[2]);p.mesh.rotation.set(0,a,0);}
  spawnSamples(config.samples);config.enemies.forEach((p,i)=>spawnEnemy(p[0],p[1],i,config));
  exitDoor.open=false;exitDoor.mesh.material.emissive.set(0x5a2118);exitDoor.mesh.material.emissiveIntensity=.75;exitDoor.mesh.material.color.set(0x8ee7c8);
  cameraYaw=0;moveYaw=null;cameraPitch=.2;cameraDistance=6.6;updateHUD();setAnimation('Idle');
}
function resetGame(){elapsed=0;setupLevel(0);}
function continueLevel(){setupLevel(levelIndex+1);state='playing';ui.end.classList.add('hidden');$('continueBtn').classList.add('hidden');showHUD(true);clock.getDelta();}
function restartLevel(){setupLevel(levelIndex);state='playing';ui.pause.classList.add('hidden');showHUD(true);clock.getDelta();}
function returnToCharacterSelect(){levelIndex=0;state='ready';ui.pause.classList.add('hidden');ui.start.classList.remove('hidden');showHUD(false);}

function bindEvents(){
  $('startBtn').addEventListener('click',startGame);$('restartBtn').addEventListener('click',startGame);$('resumeBtn').addEventListener('click',pauseGame);$('pauseBtn').addEventListener('click',pauseGame);$('pauseRestart').addEventListener('click',restartLevel);$('continueBtn').addEventListener('click',continueLevel);$('changeCharacter').addEventListener('click',returnToCharacterSelect);
  $('characterPrev').addEventListener('click',()=>{characterIndex=(characterIndex+CHARACTERS.length-1)%CHARACTERS.length;buildFallbackAvatar();applyCharacterAppearance();});
  $('characterNext').addEventListener('click',()=>{characterIndex=(characterIndex+1)%CHARACTERS.length;buildFallbackAvatar();applyCharacterAppearance();});
  $('power').addEventListener('input',e=>{power=Number(e.target.value);ui.powerValue.textContent=String(power);});
  const movementKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowRight','ArrowDown','ArrowLeft']);
  addEventListener('keydown',e=>{if(movementKeys.has(e.code)&&moveYaw===null)moveYaw=cameraYaw;keys.add(e.code);if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='Escape'){if(state==='playing'&&!pointerLocked)pauseGame();}if(e.code==='KeyE'||e.code==='KeyR')interact();if(e.code==='KeyF')fire();});
  addEventListener('keyup',e=>{keys.delete(e.code);if([...movementKeys].every(code=>!keys.has(code)))moveYaw=null;});
  addEventListener('blur',()=>{keys.clear();moveYaw=null;});
  ui.canvas.addEventListener('mousedown',e=>{if(state==='playing'){mouseDragging=true;dragCameraMoved=false;lastMouseX=e.clientX;lastMouseY=e.clientY;}});
  addEventListener('mouseup',()=>{mouseDragging=false;});
  ui.canvas.addEventListener('click',()=>{if(state==='playing'&&!dragCameraMoved)fire();dragCameraMoved=false;});
  document.addEventListener('mousemove',e=>{if(state!=='playing'||(!pointerLocked&&!mouseDragging))return;const dx=pointerLocked?e.movementX:e.clientX-lastMouseX,dy=pointerLocked?e.movementY:e.clientY-lastMouseY;if(Math.abs(dx)+Math.abs(dy)>2)dragCameraMoved=true;cameraYaw-=dx*.0025;if(moveYaw!==null)moveYaw-=dx*.0025;cameraPitch=THREE.MathUtils.clamp(cameraPitch-dy*.0018,-.03,.72);lastMouseX=e.clientX;lastMouseY=e.clientY;});
  ui.canvas.addEventListener('wheel',e=>{cameraDistance=THREE.MathUtils.clamp(cameraDistance+Math.sign(e.deltaY)*.45,4.3,9.2);},{passive:true});
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));});
  // On touchscreens, drag to rotate camera; on-screen start and actions stay usable.
  let touch=null;ui.canvas.addEventListener('touchstart',e=>{touch={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});ui.canvas.addEventListener('touchmove',e=>{if(!touch||state!=='playing')return;const t=e.touches[0],delta=(t.clientX-touch.x)*.007;cameraYaw-=delta;if(moveYaw!==null)moveYaw-=delta;cameraPitch=THREE.MathUtils.clamp(cameraPitch-(t.clientY-touch.y)*.004,-.03,.72);touch={x:t.clientX,y:t.clientY};},{passive:true});ui.canvas.addEventListener('touchend',()=>touch=null);
}

function updateGame(dt){
  elapsed+=dt;levelTimeRemaining=Math.max(0,levelTimeRemaining-dt);ui.timer.textContent=formatTime(levelTimeRemaining);ui.timer.classList.toggle('timer-warning',levelTimeRemaining<=30);player.invuln=Math.max(0,player.invuln-dt);
  if(levelTimeRemaining<=0){playSound('timeout');finish(false,'Se agotó el tiempo para completar este nivel.');return;}
  smoothPlayerInput(dt);updateEnemies(dt);updatePhysics(dt);updateHazards(dt);updateProjectiles(dt);updateParticles(dt);updateSampleVisuals(elapsed);updateCamera(dt);updateInteract();
  if(messageTimer>0){messageTimer-=dt;if(messageTimer<=0)ui.toast.style.opacity='0';}
  // Extraction only succeeds on entry after all samples have been collected.
  if(collected===currentLevel().samples.length&&player.group.position.z>14.2&&Math.abs(player.group.position.x)<6.4)completeLevel();
}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);if(state==='playing')updateGame(dt);else{updateCamera(dt);updateSampleVisuals(clock.elapsedTime);}renderer.render(scene,camera);}

async function init(){
  try{
    await RAPIER.init();world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=1/60;
    buildRoom();buildPhysicsObjects();createPlayer();setupLevel(0);bindEvents();applyCharacterAppearance();initialized=true;state='ready';
    camera.position.set(0,5,19);camera.lookAt(0,1,0);ui.loading.classList.add('done');setTimeout(()=>ui.loading.remove(),650);animate();
  }catch(err){console.error(err);ui.loading.classList.add('done');showError('No se pudo inicializar la física. Recarga la página e inténtalo de nuevo.');}
}
init();
