// Boilerplate code ////////////////////////////////////////////////////////
import * as shader from "./shaders.js";
import * as glance from "../glance/js/index.js";
const { Vec2, Vec3, Mat4 } = glance;

// Get the WebGL context
const canvas = document.getElementById('canvas');
const gl = glance.getContext(canvas);

// Basic render loop wrapper.
function setRenderLoop(callback) {
    function renderLoop(time) {
        callback(time);
        requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);
}

// Mouse event handling
function onMouseDrag(callback) {
    let isDragging = null;
    canvas.addEventListener("mousedown", () => {
        isDragging = true;
    });
    canvas.addEventListener("mousemove", (e) => {
        if (isDragging)
        {
            callback(e);
        }
    });
    canvas.addEventListener("mouseup", () => {
        isDragging = false;
    });
}

function onMouseWheel(callback) {
    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        callback(e);
    });
}

// Keyboard event handling
function onKeyUp(callback) {
    window.addEventListener("keyup", (e) => {
        callback(e);
    });
}

// Game Code Start /////////////////////////////////////////////////////////

// =====================================================================
// Game Constants
// =====================================================================

// globals
const origin = Vec3.zero();
const up = Vec3.yAxis();

// camera settings
const fov = Math.PI / 4;
const nearPlane = 0.4;
const farPlane = 200;
let cameraFocus = new Vec3(0, 0, 0);
const cameraSpeed = 0.007;
const zoomSpeed = 0.25;
const minZoom = 20;
const maxZoom = 100;
// light settings
const lightProjection = Mat4.ortho(-50., 50., -50., 50., 1., 200.);
const lightRotationSpeed = 0.0002;
const lightTilt = 0.7;
// game Settings
const trainSpeed = 0.008;
const groundPosArr = [
    // Upper Row
    new Vec3(-27.5,0,-27.5),
    new Vec3(-16.5,0,-27.5),
    new Vec3(-5.5,0,-27.5),
    new Vec3(5.5,0,-27.5),
    new Vec3(16.5,0,-27.5),
    new Vec3(27.5,0,-27.5),
    // Upper Middle Row
    new Vec3(-27.5,0,-16.5),
    new Vec3(-16.5,0,-16.5),
    new Vec3(-5.5,0,-16.5),
    new Vec3(5.5,0,-16.5),
    new Vec3(16.5,0,-16.5),
    new Vec3(27.5,0,-16.5),
    // Upper Middle Middle Row
    new Vec3(-27.5,0,-5.5),
    new Vec3(-16.5,0,-5.5),
    new Vec3(-5.5,0,-5.5),
    new Vec3(5.5,0,-5.5),
    new Vec3(16.5,0,-5.5),
    new Vec3(27.5,0,-5.5),
    // Lower Middle Middle Row
    new Vec3(-27.5,0,5.5),
    new Vec3(-16.5,0,5.5),
    new Vec3(-5.5,0,5.5),
    new Vec3(5.5,0,5.5),
    new Vec3(16.5,0,5.5),
    new Vec3(27.5,0,5.5),
    // Lower Middle Row
    new Vec3(-27.5,0,16.5),
    new Vec3(-16.5,0,16.5),
    new Vec3(-5.5,0,16.5),
    new Vec3(5.5,0,16.5),
    new Vec3(16.5,0,16.5),
    new Vec3(27.5,0,16.5),
    // Lower Row
    new Vec3(-27.5,0,27.5),
    new Vec3(-16.5,0,27.5),
    new Vec3(-5.5,0,27.5),
    new Vec3(5.5,0,27.5),
    new Vec3(16.5,0,27.5),
    new Vec3(27.5,0,27.5),
];
const groundPosArrIds = Array.from({ length: groundPosArr.length }, (_, i) => i);

// declare moving rules based on index position in groundPosArr 
const middleTiles = [7,8,9,10,13,14,15,16,19,20,21,22,25,26,27,28];
const upperRowTiles = [1,2,3,4];
const leftRowTiles = [6,12,18,24];
const rightRowTiles = [11,17,23,29];
const lowerRowTiles = [31,32,33,34];
const upperLeftCorner = [0];
const upperRightCorner = [5];
const lowerLeftCorner = [30];
const lowerRightCorner = [35];
// positions of special tiles in groundPosArr
const blockedTiles = [2, 10, 18, 26];
const trainStationTiles = [6, 23, 32];
const allTrainStationTiles = [4, 6, 23, 24, 32];
const fuelTiles = [8, 20, 35];

// flatten groundPos Array because Shader can only take one-dimensional Arrays
let groundPosArrFlat = [];
for (var groundElement of groundPosArr) {
    groundPosArrFlat.push(groundElement[0]);
    groundPosArrFlat.push(groundElement[1]);
    groundPosArrFlat.push(groundElement[2]);
}

function isAllowedToMove(direction) {
    if (currentTile === 4) {
        return false;
    }
    else {
        if (middleTiles.includes(currentTile)) {
            return true;
        }
        else if (upperRowTiles.includes(currentTile)) {
            if (direction === "down" || direction === "left" || direction === "right") return true;
        }
        else if (leftRowTiles.includes(currentTile)) {
            if (direction === "up" || direction === "down" || direction === "right") return true;
        }
        else if (rightRowTiles.includes(currentTile)) {
            if (direction === "up" || direction === "down" || direction === "left") return true;
        }
        else if (lowerRowTiles.includes(currentTile)) {
            if (direction === "up" || direction === "left" || direction === "right") return true;
        }
        else if (upperLeftCorner.includes(currentTile)) {
            if (direction === "down" || direction === "right") return true;
        }
        else if (upperRightCorner.includes(currentTile)) {
            if (direction === "down" || direction === "left") return true;
        }
        else if (lowerLeftCorner.includes(currentTile)) {
            if (direction === "up" || direction === "right") return true;
        }
        else if (lowerRightCorner.includes(currentTile)) {
            if (direction === "up" || direction === "left") return true;
        }
        return false;
    }
} 

// =====================================================================
// Game State
// =====================================================================

let isTrainDriving = false;
let gameFinished = false;

let pan = 0;
onMouseDrag((e) => {
    if (isTrainDriving) {
        pan -= e.movementX * cameraSpeed;
    }
});
let zoom = 90.0;
onMouseWheel((e) => {
    if (isTrainDriving) {
        const factor = 1 + Math.sign(e.deltaY) * zoomSpeed;
        zoom = glance.clamp(zoom * factor, minZoom, maxZoom);
    }
});

const projectionMatrix = Mat4.perspective(fov, gl.canvas.width / gl.canvas.height, nearPlane, farPlane);

// variables to move Train
let trainPos = new Vec3(-27.5,100,16.5);
let trainRotY = 0;
let trainDestination = 24;
let trainDestinationIndex = 0;

/// the user can select the tiles around the current one with the arrow keys
let currentTile = 24;
let tilesSelected = [24];

// create array with a number of elements that are greater than the possibly laid down number of tiles so that the 
// instance shaders don't have to take a new array with every set tile but can change the values of this one
let tilesSelectedPlacing = [24];
for (let i = 1; i < groundPosArr.length; i++) {
    tilesSelectedPlacing.push(-1);
}

// initial number of fuel + function to update count
let fuelCount = 8;
function updateFuelTracks() {
    fuelCount -= 1;
    if (fuelTiles.includes(currentTile)) {
        fuelCount += 7;
    }

    // update instance attribute from train tracks based on placed tiles
    if (trainTrackIABO) {
        gl.bindBuffer(gl.ARRAY_BUFFER, trainTrackIABO.glObject);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(tilesSelectedPlacing));
    }
}

onKeyUp((e) => {
    // only allow placing tracks if train isn't driving and fuel isn't empty
    if (!isTrainDriving && fuelCount > 0) {
        if (e.key === "ArrowUp") {
            if (isAllowedToMove("up")) {
                if (!tilesSelected.includes(currentTile - 6) && !blockedTiles.includes(currentTile - 6)) {
                    // update current Tile based on move direction, push to array, update instancing-array and call fuel function
                    currentTile -= 6;
                    tilesSelected.push(currentTile);
                    tilesSelectedPlacing[tilesSelected.length-1] = currentTile;
                    updateFuelTracks();
                }
            }
        }
        else if (e.key === "ArrowDown") {
            if (isAllowedToMove("down")) {
                if (!tilesSelected.includes(currentTile + 6) && !blockedTiles.includes(currentTile + 6)) {
                    currentTile += 6;
                    tilesSelected.push(currentTile);
                    tilesSelectedPlacing[tilesSelected.length-1] = currentTile;
                    updateFuelTracks();
                }
            }
        }
        else if (e.key === "ArrowLeft") {
            if (isAllowedToMove("left")) {
                if (!tilesSelected.includes(currentTile - 1) && !blockedTiles.includes(currentTile - 1)) {
                    currentTile -= 1;
                    tilesSelected.push(currentTile);
                    tilesSelectedPlacing[tilesSelected.length-1] = currentTile;
                    updateFuelTracks();
                }
            }
        }
        else if (e.key === "ArrowRight") {
            if (isAllowedToMove("right")) {
                if (!tilesSelected.includes(currentTile + 1) && !blockedTiles.includes(currentTile + 1)) {
                    currentTile += 1;
                    tilesSelected.push(currentTile);
                    tilesSelectedPlacing[tilesSelected.length-1] = currentTile;
                    updateFuelTracks();
                }
            }
        }
    }
    if (e.key === "Enter" && tilesSelected.length > 1) {
        isTrainDriving = true;
    }
    if (e.key === "Backspace") {
        // reset game state
        currentTile = 24;
        tilesSelected = [];
        tilesSelected.push(24);
        tilesSelectedPlacing = [];
        tilesSelectedPlacing.push(24);
        for (let i = 1; i < groundPosArr.length; i++) {
            tilesSelectedPlacing.push(-1);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, trainTrackIABO.glObject);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(tilesSelectedPlacing));
        trainPos = new Vec3(-27.5,100,16.5);
        trainRotY = 0;
        trainDestination = 24;
        trainDestinationIndex = 0;
        pan = 0;
        zoom = 90.0;
        isTrainDriving = false;
        gameFinished = false;
        fuelCount = 8;
        cameraFocus = new Vec3(0,0,0);
        document.getElementById("fuel-counter-div").style.display = "grid";
    }
});

// These variables are used by the draw calls.
// They will be updated in the render loop.
const viewPos = Vec3.zero();
const viewMatrix = Mat4.identity();

// Variables for the light
const lightPos = Vec3.zero();
const lightParallaxPos = Vec3.zero();
const lightXform = Mat4.identity();

// =====================================================================
// Shadow Depth Texture
// =====================================================================

const shadowDepthTexture = glance.createTexture(gl, "shadow-depth", 2048, 2048, gl.TEXTURE_2D, null, {
    useAnisotropy: false,
    internalFormat: gl.DEPTH_COMPONENT16,
    levels: 1,
    filter: gl.NEAREST,
});

// =====================================================================
// Create Shaders
// =====================================================================

const skyboxShader = glance.createShader(gl, "skybox-shader", shader.skyboxVSSource, shader.skyboxFSSource, {
    u_skybox: 0, // read the skybox from texture unit 0
});

const tileshader = glance.createShader(gl, "world-shader", shader.groundInstanceVSSource, shader.trackFSSource, {
    u_ambient: 0.3,
    u_diffuse: 0.9,
    u_specular: 0.6,
    u_shininess: 128,
    u_lightColor: [1, 1, 1],
    u_texDiffuse: 0,
    u_texSpecular: 1,
    u_texNormal: 2,
    u_texDepth: 3,
    u_texShadow: 4,
    u_lightProjection: lightProjection,
});

const groundShader = glance.createShader(gl, "ground-shader", shader.groundVSSource, shader.groundFSSource, {
    u_ambient: 0.5,
    u_diffuse: 0.9,
    u_specular: 0.4,
    u_shininess: 128,
    u_lightColor: [1, 1, 1],
    u_texDiffuse: 0,
    u_texSpecular: 1,
    u_texNormal: 2,
    u_texShadow: 3,
    u_lightProjection: lightProjection,
});

const worldObjectsShader = glance.createShader(gl, "world-objects-shader", shader.worldinstanceVSSource, shader.trainFSSource, {
    u_texDiffuse: 0,
    u_texShadow: 1,
    u_lightProjection: lightProjection,
});

const trainShader = glance.createShader(gl, "train-shader", shader.trainVSSource, shader.trainFSSource, {
    u_texDiffuse: 0,
    u_texShadow: 1,
    u_lightProjection: lightProjection,
});

const shadowShader = glance.createShader(gl, "shadow-shader", shader.shadowVSSource, shader.shadowFSSource, {
    u_lightProjection: lightProjection,
});

const shadowInstanceShader = glance.createShader(gl, "shadow-instance-shader", shader.shadowInstanceVSSource, shader.shadowFSSource, {
    u_lightProjection: lightProjection,
});

const postShader = glance.createShader(gl, "post-shader", shader.postVSSource, shader.postFSSource, {
    u_texture: 0,
    u_textLayer: 1,
});

// =====================================================================
// Create Geometry + Load Textures
// =====================================================================

/// Skybox
const skyboxGeo = glance.createBox("skybox-geo");
const skyboxIBO = glance.createIndexBuffer(gl, skyboxGeo.indices);
const skyboxABO = glance.createAttributeBuffer(gl, "skybox-abo", {
    a_pos: { data: skyboxGeo.positions, height: 3 },
});
const skyboxVAO = glance.createVAO(
    gl,
    "skybox-vao",
    skyboxIBO,
    glance.buildAttributeMap(skyboxShader, [skyboxABO]),
);

const skyboxTexture = await glance.loadCubemapNow(gl, "skybox-texture", [
    "Assets/Textures/Skybox/westernRight.jpg",
    "Assets/Textures/Skybox/westernLeft.jpg",
    "Assets/Textures/Skybox/westernTop.jpg",
    "Assets/Textures/Skybox/westernBottom.jpg",
    "Assets/Textures/Skybox/westernFront.jpg",
    "Assets/Textures/Skybox/westernBack.jpg",
]);

// Ground Tiles
const tilesGeo = glance.createPlane("tiles-geo", { width: 6, height: 5});

const tilesIBO = glance.createIndexBuffer(gl, tilesGeo.indices);
const tilesABO = glance.createAttributeBuffer(gl, "tiles-abo", {
    a_pos: { data: tilesGeo.positions, height: 3 },
    a_normal: { data: tilesGeo.normals, height: 3 },
    a_texCoord: { data: tilesGeo.texCoords, height: 2 },
    a_tangent: { data: tilesGeo.tangents, height: 3 },
});
const tilesIABO = glance.createAttributeBuffer(gl, "tiles-iabo", {
    a_instancePos: { data: groundPosArrIds, height: 1, divisor: 1 },
});

const tilesVAO = glance.createVAO(gl, "tiles-vao", tilesIBO, glance.buildAttributeMap(tileshader, [tilesABO, tilesIABO]));

const tilesTextureDiffuse = glance.loadTexture(gl, 1024, 1024, "Assets/Textures/Environment/rockdiff.jpg");
const tilesTextureSpecular = glance.loadTexture(gl, 1024, 1024, "Assets/Textures/Environment/rockao.jpg");
const tilesTextureNormal = glance.loadTexture(gl, 1024, 1024, "Assets/Textures/Environment/rocknorm.jpg");
const tilesTextureDepth = glance.loadTexture(gl, 1024, 1024, "Assets/Textures/Environment/rockdepth.jpg");

// Trees
const treeGeo = await glance.loadObj("Assets/OBJ/tree.obj");
const treeIBO = glance.createIndexBuffer(gl, treeGeo.indices);
const treeABO = glance.createAttributeBuffer(gl, "tree-abo", {
    a_pos: { data: treeGeo.positions, height: 3 },
    a_normal: { data: treeGeo.normals, height: 3 },
    a_texCoord: { data: treeGeo.texCoords, height: 2 },
});
const treeIABO = glance.createAttributeBuffer(gl, "tree-iabo", {
    a_instancePos: { data: blockedTiles, height: 1, divisor: 1 },
});

const treeVAO = glance.createVAO(gl, "tree-vao", treeIBO, glance.buildAttributeMap(worldObjectsShader, [treeABO, treeIABO]));

const treeTexture = glance.loadTexture(gl, 512, 512, "Assets/Textures/Objects/tree.png");

// Train Stations
const stationGeo = await glance.loadObj("Assets/OBJ/station.obj");
const stationIBO = glance.createIndexBuffer(gl, stationGeo.indices);
const stationABO = glance.createAttributeBuffer(gl, "station-abo", {
    a_pos: { data: stationGeo.positions, height: 3 },
    a_normal: { data: stationGeo.normals, height: 3 },
    a_texCoord: { data: stationGeo.texCoords, height: 2 },
});
const stationIABO = glance.createAttributeBuffer(gl, "station-iabo", {
    a_instancePos: { data: allTrainStationTiles, height: 1, divisor: 1 },
});

const stationVAO = glance.createVAO(gl, "station-vao", stationIBO, glance.buildAttributeMap(worldObjectsShader, [stationABO, stationIABO]));

const stationTexture = glance.loadTexture(gl, 512, 512, "Assets/Textures/Objects/wood.png");

// Fuel Stations
const fuelGeo = await glance.loadObj("Assets/OBJ/tower.obj");
const fuelIBO = glance.createIndexBuffer(gl, fuelGeo.indices);
const fuelABO = glance.createAttributeBuffer(gl, "fuel-abo", {
    a_pos: { data: fuelGeo.positions, height: 3 },
    a_normal: { data: fuelGeo.normals, height: 3 },
    a_texCoord: { data: fuelGeo.texCoords, height: 2 },
});
const fuelIABO = glance.createAttributeBuffer(gl, "fuel-iabo", {
    a_instancePos: { data: fuelTiles, height: 1, divisor: 1 },
});

const fuelVAO = glance.createVAO(gl, "fuel-vao", fuelIBO, glance.buildAttributeMap(worldObjectsShader, [fuelABO, fuelIABO]));

const fuelTexture = glance.loadTexture(gl, 512, 512, "Assets/Textures/Objects/tower.png");

// Train Tracks
const trainTrackGeo = await glance.loadObj("Assets/OBJ/track.obj");
const trainTrackIBO = glance.createIndexBuffer(gl, trainTrackGeo.indices);
const trainTrackABO = glance.createAttributeBuffer(gl, "trainTrack-abo", {
    a_pos: { data: trainTrackGeo.positions, height: 3 },
    a_normal: { data: trainTrackGeo.normals, height: 3 },
    a_texCoord: { data: trainTrackGeo.texCoords, height: 2 },
});

const trainTrackTexture = glance.loadTexture(gl, 512, 512, "Assets/Textures/Objects/track.png");

const trainTrackIABO = glance.createAttributeBuffer(gl, "trainTrack-iabo", {
    a_instancePos: { data: tilesSelectedPlacing, height: 1, divisor: 1 },
});

const trainTrackVAO = glance.createVAO(gl, "trainTrack-vao", trainTrackIBO, glance.buildAttributeMap(worldObjectsShader, [trainTrackABO, trainTrackIABO]));

// Goal Flag
const flagGeo = await glance.loadObj("Assets/OBJ/flag.obj");
const flagIBO = glance.createIndexBuffer(gl, flagGeo.indices);
const flagABO = glance.createAttributeBuffer(gl, "flag-abo", {
    a_pos: { data: flagGeo.positions, height: 3 },
    a_normal: { data: flagGeo.normals, height: 3 },
    a_texCoord: { data: flagGeo.texCoords, height: 2 },
});

const flagVAO = glance.createVAO(gl, "flag-vao", flagIBO, glance.buildAttributeMap(trainShader, [flagABO]));

const flagTexture = glance.loadTexture(gl, 512, 512, "Assets/Textures/Objects/tree.png");

// Train Cars
const trainGeo = await glance.loadObj("Assets/OBJ/Train.obj");
const trainIBO = glance.createIndexBuffer(gl, trainGeo.indices);
const trainABO = glance.createAttributeBuffer(gl, "train-abo", {
    a_pos: { data: trainGeo.positions, height: 3 },
    a_normal: { data: trainGeo.normals, height: 3 },
    a_texCoord: { data: trainGeo.texCoords, height: 2 },
});

const trainVAO = glance.createVAO(gl, "train-vao", trainIBO, glance.buildAttributeMap(trainShader, [trainABO]));

const trainTexture = glance.loadTexture(gl, 2048, 2048, "Assets/Textures/Objects/train.png");

// Ground
const groundGeo = glance.createCircularPlane("ground-geo", {
    radius: 5,
    segments: 64,
});

const groundIBO = glance.createIndexBuffer(gl, groundGeo.indices);
const groundABO = glance.createAttributeBuffer(gl, "ground-abo", {
    a_pos: { data: groundGeo.positions, height: 3 },
    a_normal: { data: groundGeo.normals, height: 3 },
    a_texCoord: { data: groundGeo.texCoords, height: 2 },
    a_tangent: { data: groundGeo.tangents, height: 3 }
});

const groundVAO = glance.createVAO(gl, "ground-vao", groundIBO, glance.buildAttributeMap(groundShader, [groundABO]));

const groundDiffTexture = glance.loadTexture(gl, 1024, 1024, "Assets/Textures/Environment/grounddiff.jpg");
const groundSpecTexture = glance.loadTexture(gl, 1024, 1024, "Assets/Textures/Environment/groundao.jpg");
const groundNormTexture = glance.loadTexture(gl, 1024, 1024, "Assets/Textures/Environment/groundnorm.jpg");

// =====================================================================
// World Object Draw Calls
// =====================================================================

const skyboxDrawCall = glance.createDrawCall(gl, skyboxShader, skyboxVAO, {
    uniforms: {
        u_viewMatrix: () => viewMatrix,
        u_projectionMatrix: () => projectionMatrix,
    },
    textures: [
        [0, skyboxTexture], // bind the skybox texture to texture unit 0
    ],
    cullFace: gl.NONE,
    depthTest: gl.LEQUAL,
});

const tilesDrawCall = glance.createDrawCall(gl, tileshader, tilesVAO, {
    uniforms: {
        u_viewMatrix: () => viewMatrix,
        u_projectionMatrix: () => projectionMatrix,
        u_viewPos: () => viewPos,
        u_lightPosition: () => lightParallaxPos,
        u_lightXform: () => lightXform,
        u_groundArr: () => groundPosArrFlat,

    },
    textures: [
        [0, tilesTextureDiffuse],
        [1, tilesTextureSpecular],
        [2, tilesTextureNormal],
        [3, tilesTextureDepth],
        [4, shadowDepthTexture]
    ],
    cullFace: gl.BACK,
    depthTest: gl.LESS,
    instances: () => groundPosArrIds.length,
    enabled: () => groundPosArrIds.length > 0,
});

const treeDrawCall = glance.createDrawCall(gl, worldObjectsShader, treeVAO, {
    uniforms: {
        u_viewMatrix: () => viewMatrix,
        u_projectionMatrix: () => projectionMatrix,
        u_viewPos: () => viewPos,
        u_lightPosition: () => lightPos,
        u_lightXform: () => lightXform,
        u_groundArr: () => groundPosArrFlat,
        u_type: () => 2,
    },
    textures: [
        [0, treeTexture],
        [1, shadowDepthTexture]
    ],
    cullFace: gl.BACK,
    depthTest: gl.LESS,
    instances: () => blockedTiles.length,
    enabled: () => blockedTiles.length > 0,
});

const stationDrawCall = glance.createDrawCall(gl, worldObjectsShader, stationVAO, {
    uniforms: {
        u_viewMatrix: () => viewMatrix,
        u_projectionMatrix: () => projectionMatrix,
        u_viewPos: () => viewPos,
        u_lightPosition: () => lightPos,
        u_lightXform: () => lightXform,
        u_groundArr: () => groundPosArrFlat,
        u_type: () => 3,
    },
    textures: [
        [0, stationTexture],
        [1, shadowDepthTexture]
    ],
    cullFace: gl.BACK,
    depthTest: gl.LESS,
    instances: () => allTrainStationTiles.length,
    enabled: () => allTrainStationTiles.length > 0,
});

const fuelDrawCall = glance.createDrawCall(gl, worldObjectsShader, fuelVAO, {
    uniforms: {
        u_viewMatrix: () => viewMatrix,
        u_projectionMatrix: () => projectionMatrix,
        u_viewPos: () => viewPos,
        u_lightPosition: () => lightPos,
        u_lightXform: () => lightXform,
        u_groundArr: () => groundPosArrFlat,
        u_type: () => 4,
    },
    textures: [
        [0, fuelTexture],
        [1, shadowDepthTexture]
    ],
    cullFace: gl.BACK,
    depthTest: gl.LESS,
    instances: () => fuelTiles.length,
    enabled: () => fuelTiles.length > 0,
});

const trainTrackDrawCall = glance.createDrawCall(gl, worldObjectsShader, trainTrackVAO, {
    uniforms: {
        u_viewMatrix: () => viewMatrix,
        u_projectionMatrix: () => projectionMatrix,
        u_viewPos: () => viewPos,
        u_lightPosition: () => lightPos,
        u_lightXform: () => lightXform,
        u_groundArr: () => groundPosArrFlat,
        u_type: () => 5,
    },
    textures: [
        [0, trainTrackTexture],
        [1, shadowDepthTexture]
    ],
    cullFace: gl.BACK,
    depthTest: gl.LESS,
    instances: () => tilesSelectedPlacing.length,
    enabled: () => tilesSelectedPlacing.length > 0,
});

const flagDrawCall = glance.createDrawCall(gl, trainShader, flagVAO, {
    uniforms: {
        u_modelMatrix: ({time}) => Mat4.fromTranslation(new Vec3(20,0,-30)).scale((Math.cos(time/400) + 4)),
        u_viewMatrix: () => viewMatrix,
        u_projectionMatrix: () => projectionMatrix,
        u_viewPos: () => viewPos,
        u_lightPosition: () => lightPos,
        u_lightXform: () => lightXform,
    },
    textures: [
        [0, flagTexture],
        [1, shadowDepthTexture]
    ],
    cullFace: gl.BACK,
    depthTest: gl.LESS,
});

const trainDrawCall = glance.createDrawCall(gl, trainShader, trainVAO, {
    uniforms: {
        u_modelMatrix: () => Mat4.fromTranslation(trainPos).rotateY(trainRotY),
        u_viewMatrix: () => viewMatrix,
        u_projectionMatrix: () => projectionMatrix,
        u_viewPos: () => viewPos,
        u_lightPosition: () => lightPos,
        u_lightXform: () => lightXform,
    },
    textures: [
        [0, trainTexture],
        [1, shadowDepthTexture]
    ],
    cullFace: gl.BACK,
    depthTest: gl.LESS,
});

const groundDrawCall = glance.createDrawCall(gl, groundShader, groundVAO, {
    uniforms: {
        u_modelMatrix: () => Mat4.fromTranslation(new Vec3(0,-0.01,0)).rotateX(-Math.PI/2).scale(10),
        u_viewMatrix: () => viewMatrix,
        u_projectionMatrix: () => projectionMatrix,
        u_viewPos: () => viewPos,
        u_lightPosition: () => lightParallaxPos,
        u_lightXform: () => lightXform,
    },
    textures: [
        [0, groundDiffTexture],
        [1, groundSpecTexture],
        [2, groundNormTexture],
        [3, shadowDepthTexture]
    ],
    cullFace: gl.BACK,
    depthTest: gl.LESS,
});

// =====================================================================
// Shadow Framebuffer + Draw Calls
// =====================================================================

const shadowFramebuffer = glance.createFramebuffer(gl, "shadow-framebuffer", null, shadowDepthTexture);

const shadowDrawCalls = [
    glance.createDrawCall(gl, shadowShader, flagVAO, {
        uniforms: {
            u_modelMatrix: ({time}) => Mat4.fromTranslation(new Vec3(20,0,-30)).scale((Math.cos(time/400) + 4)),
            u_lightXform: () => lightXform,
        },
        cullFace: gl.BACK,
        depthTest: gl.LESS,
    }),
    glance.createDrawCall(gl, shadowShader, trainVAO, {
        uniforms: {
            u_modelMatrix: () => Mat4.fromTranslation(trainPos).rotateY(trainRotY),
            u_lightXform: () => lightXform,
        },
        cullFace: gl.BACK,
        depthTest: gl.LESS,
    }),
    glance.createDrawCall(gl, shadowInstanceShader, treeVAO, {
        uniforms: {
            u_groundArr: () => groundPosArrFlat,
            u_lightXform: () => lightXform,
            u_type: () => 2,
        },
        cullFace: gl.BACK,
        depthTest: gl.LESS,
        instances: () => blockedTiles.length,
        enabled: () => blockedTiles.length > 0,
    }),
    glance.createDrawCall(gl, shadowInstanceShader, stationVAO, {
        uniforms: {
            u_groundArr: () => groundPosArrFlat,
            u_lightXform: () => lightXform,
            u_type: () => 3,
        },
        cullFace: gl.BACK,
        depthTest: gl.LESS,
        instances: () => allTrainStationTiles.length,
        enabled: () => allTrainStationTiles.length > 0,
    }),
    glance.createDrawCall(gl, shadowInstanceShader, fuelVAO, {
        uniforms: {
            u_groundArr: () => groundPosArrFlat,
            u_lightXform: () => lightXform,
            u_type: () => 4,
        },
        cullFace: gl.BACK,
        depthTest: gl.LESS,
        instances: () => fuelTiles.length,
        enabled: () => fuelTiles.length > 0,
    }),
    glance.createDrawCall(gl, shadowInstanceShader, trainTrackVAO, {
        uniforms: {
            u_groundArr: () => groundPosArrFlat,
            u_lightXform: () => lightXform,
            u_type: () => 5,
        },
        cullFace: gl.BACK,
        depthTest: gl.LESS,
        instances: () => tilesSelectedPlacing.length,
        enabled: () => tilesSelectedPlacing.length > 0,
    })
];


// =====================================================================
// Post Plane Creation + Framebuffer + Draw Calls
// =====================================================================

const postGeo = glance.createScreenQuat("post-geo", {
    in2D: true,
});

const postIBO = glance.createIndexBuffer(gl, postGeo.indices);
const postABO = glance.createAttributeBuffer(gl, "post-abo", {
    a_pos: { data: postGeo.positions, height: 2 },
    a_texCoord: { data: postGeo.texCoords, height: 2 },
});
const postVAO = glance.createVAO(gl, "post-vao", postIBO, glance.buildAttributeMap(postShader, [postABO]));

const winTextTexture = glance.loadTexture(gl, 800, 800, "Assets/Style/win-stencil.png");
const loseTextTexture = glance.loadTexture(gl, 800, 800, "Assets/Style/lose-stencil.png");

const postTexture = glance.createTexture(
    gl,
    "color-target",
    800,
    800,
    gl.TEXTURE_2D,
    null,
    {
        useAnisotropy: false,
        internalFormat: gl.RGBA8,
        levels: 1,
    },
);

const postDepth = gl.createRenderbuffer();
gl.bindRenderbuffer(gl.RENDERBUFFER, postDepth);
gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, 800, 800);
gl.bindRenderbuffer(gl.RENDERBUFFER, null);

const postFramebuffer = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, postFramebuffer);
gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    postTexture.glObject,
/* level= */ 0,
);
gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, postDepth);
let fbStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
if (fbStatus !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error("Framebuffer incomplete");
}
gl.bindFramebuffer(gl.FRAMEBUFFER, null);

const postWinDrawCall = glance.createDrawCall(gl, postShader, postVAO, {
    uniforms: {
        u_color: () => new Vec3(0.2, 1.0, 0.2),
    },
    textures: [
        [0, postTexture],
        [1, winTextTexture],
    ],
    cullFace: gl.NONE,
    depthTest: gl.NONE,
});

const postLoseDrawCall = glance.createDrawCall(gl, postShader, postVAO, {
    uniforms: {
        u_color: () => new Vec3(1.0, 0.2, 0.2),
    },
    textures: [
        [0, postTexture],
        [1, loseTextTexture],
    ],
    cullFace: gl.NONE,
    depthTest: gl.NONE,
});

// =====================================================================
// Render Loop
// =====================================================================

let lastTime = -1;
const framebufferStack = new glance.FramebufferStack();

setRenderLoop((time) => {
    const deltaTime = lastTime >= 0 ? time - lastTime : 0;
    lastTime = time;

    // Update the light
    lightPos.set(0, 0, -1).rotateX(lightTilt).rotateY(time * lightRotationSpeed);
    lightParallaxPos.set(0, 0, -80).rotateX(lightTilt).rotateY(time * lightRotationSpeed);
    lightXform.lookAt(lightParallaxPos, origin, up);

    // Render shadow map
    framebufferStack.push(gl, shadowFramebuffer);
    {
        gl.clear(gl.DEPTH_BUFFER_BIT);
        for (const drawCall of shadowDrawCalls)
        {
            glance.performDrawCall(gl, drawCall, time);
        }
    }
    framebufferStack.pop(gl);

    // add Post Framebuffer if end is reached
    if (gameFinished) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, postFramebuffer);
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //perform draw calls
    glance.performDrawCall(gl, skyboxDrawCall, time);
    glance.performDrawCall(gl, tilesDrawCall, time);
    glance.performDrawCall(gl, treeDrawCall, time);
    glance.performDrawCall(gl, stationDrawCall, time);
    glance.performDrawCall(gl, fuelDrawCall, time);
    glance.performDrawCall(gl, trainTrackDrawCall, time);
    glance.performDrawCall(gl, flagDrawCall, time);
    glance.performDrawCall(gl, groundDrawCall, time);

    if (isTrainDriving) {
        // exit tile setting state and enter train driving state
        document.getElementById("fuel-counter-div").style.display = "none";
        // train is at start position
        if (trainDestination === 24) {
            trainPos = new Vec3(-27.5,1,16.5);
            trainDestinationIndex += 1;
            trainDestination = tilesSelected[trainDestinationIndex];
            // rotate train based on if x or z is about to change, because from start there are only two possible rotations
            if (groundPosArr[trainDestination].x === Math.round(trainPos.x * 10) /10) {
                trainRotY = Math.PI;
            }
            else if (groundPosArr[trainDestination].z === Math.round(trainPos.z * 10) /10) {
                trainRotY = 1.5*Math.PI;
            }
        }
        // train is about to reach finish
        else if (trainDestination === 4) {
            // rotate train based on current and next tile index in groundPosArr
            if (tilesSelected[trainDestinationIndex-1] < tilesSelected[trainDestinationIndex]) {
                trainRotY = 1.5*Math.PI;
            }
            else if (tilesSelected[trainDestinationIndex-1] > tilesSelected[trainDestinationIndex]) {
                trainRotY = 0.5*Math.PI;
            }
        }
        // train has reached the position of the next tile in the tilesSelected Array
        else if (groundPosArr[trainDestination].equals(new Vec3(Math.round(trainPos.x * 10) /10, 0, Math.round(trainPos.z * 10) /10)) && trainDestination !== 4 && trainDestinationIndex+1 < tilesSelected.length) {
            trainDestinationIndex += 1;
            trainDestination = tilesSelected[trainDestinationIndex];
            // rotate train based on current and next tile index in groundPosArr
            if (groundPosArr[trainDestination].x === Math.round(trainPos.x * 10) /10) {
                if (tilesSelected[trainDestinationIndex-1] < tilesSelected[trainDestinationIndex]) {
                    trainRotY = Math.PI;
                }
                else if (tilesSelected[trainDestinationIndex-1] > tilesSelected[trainDestinationIndex]) {
                    trainRotY = 0;
                }
            }
            else if (groundPosArr[trainDestination].z === Math.round(trainPos.z * 10) /10) {
                if (tilesSelected[trainDestinationIndex-1] < tilesSelected[trainDestinationIndex]) {
                    trainRotY = 1.5*Math.PI;
                }
                else if (tilesSelected[trainDestinationIndex-1] > tilesSelected[trainDestinationIndex]) {
                    trainRotY = 0.5*Math.PI;
                }
            }
        }

        // if train has arrived at last selected tile, set game to finished
        if (groundPosArr[tilesSelected[tilesSelected.length-1]].equals(new Vec3(Math.round(trainPos.x * 10) /10, 0, Math.round(trainPos.z * 10) /10))) {
            gameFinished = true;
        }

        // train position performs linear interpolation from current tile position to next tile position + perform train draw call
        trainPos.lerp(new Vec3(groundPosArr[trainDestination].x, 1, groundPosArr[trainDestination].z), deltaTime * trainSpeed);
        glance.performDrawCall(gl, trainDrawCall, time);

        // camera is following train position
        cameraFocus = trainPos;
        // camera is pannable in a set angle
        viewPos.set(0, 0, zoom).rotateX(-Math.PI/8).rotateY(pan).add(cameraFocus);
    }
    else {
        // while in tile setting state, camera is static
        viewPos.set(0, 0, zoom).rotateX(-Math.PI/2).add(cameraFocus);
    }
    viewMatrix.lookAt(viewPos, cameraFocus, up);

    // update the fuelcount
    document.getElementById("fuel-counter-span").textContent = fuelCount;

    // add Post Framebuffer if end is reached
    if (gameFinished) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);
        // set win or fail based on if every train station was passed
        if (isTrainDriving && trainDestination === 4 && trainStationTiles.every(v => tilesSelected.includes(v))) {
            glance.performDrawCall(gl, postWinDrawCall, time);
        }
        else {
            glance.performDrawCall(gl, postLoseDrawCall, time);
        }
    }
});

// Game Code End ///////////////////////////////////////////////////////////