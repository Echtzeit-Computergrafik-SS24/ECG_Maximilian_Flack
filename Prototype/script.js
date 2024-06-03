// Boilerplate code ////////////////////////////////////////////////////////

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
function onKeyDown(callback) {
    window.addEventListener("keydown", (e) => {
        callback(e);
    });
}
function onKeyUp(callback) {
    window.addEventListener("keyup", (e) => {
        callback(e);
    });
}

// Game Code Start /////////////////////////////////////////////////////////

// =====================================================================
// Game Constants
// =====================================================================

const fov = Math.PI / 4;
const nearPlane = 0.4;
const farPlane = 120;
const cameraFocus = new Vec3(0, 0, 4);
const cameraSpeed = 0.007;
const zoomSpeed = 0.25;
const minZoom = 20;
const maxZoom = 80;
const lightDirection = new Vec3(-1, 1, -1).normalize();
const trainSpeed = 0.004;
const groundPosArr = [
    // Upper Row
    new Vec3(-22,0,-18),
    new Vec3(-11,0,-18),
    new Vec3(0,0,-18),
    new Vec3(11,0,-18),
    new Vec3(22,0,-18),
    // Upper Middle Row
    new Vec3(-22,0,-7),
    new Vec3(-11,0,-7),
    new Vec3(0,0,-7),
    new Vec3(11,0,-7),
    new Vec3(22,0,-7),
    // Middle Row
    new Vec3(-22,0,4),
    new Vec3(-11,0,4),
    new Vec3(0,0,4),
    new Vec3(11,0,4),
    new Vec3(22,0,4),
    // Lower Middle Row
    new Vec3(-22,0,15),
    new Vec3(-11,0,15),
    new Vec3(0,0,15),
    new Vec3(11,0,15),
    new Vec3(22,0,15),
    // Lower Row
    new Vec3(-22,0,26),
    new Vec3(-11,0,26),
    new Vec3(0,0,26),
    new Vec3(11,0,26),
    new Vec3(22,0,26)
];
// declare moving rules based on index position in groundPosArr 
const middleTiles = [6,7,8,11,12,13,16,17,18];
const upperRowTiles = [1,2,3];
const leftRowTiles = [5,10,15];
const rightRowTiles = [9,14,19];
const lowerRowTiles = [21,22,23];
const upperLeftCorner = [0];
const upperRightCorner = [4];
const lowerLeftCorner = [20];
const lowerRightCorner = [24];

function isAllowedToMove(direction) {
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
        return false;
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

// =====================================================================
// Game State
// =====================================================================

let isTrainDriving = false;

let pan = 0;
onMouseDrag((e) => {
    if (isTrainDriving) {
        pan -= e.movementX * cameraSpeed;
    }
});
let zoom = 70.0;
onMouseWheel((e) => {
    if (isTrainDriving) {
        const factor = 1 + Math.sign(e.deltaY) * zoomSpeed;
        zoom = glance.clamp(zoom * factor, minZoom, maxZoom);
    }
});

const projectionMatrix = Mat4.perspective(fov, gl.canvas.width / gl.canvas.height, nearPlane, farPlane);

let trainPos = new Vec3(-22,3,26);
let trainRotY = 0;
let trainDestination = 20;
let trainDestinationIndex = 0;

/// The user can select the tiles around the current one with the arrow keys
let currentTile = 20;
let tilesSelected = [20];
let blockedTiles = [5, 17, 3, 8, 11, 18];

onKeyUp((e) => {
    if (e.key === "ArrowUp") {
        if (isAllowedToMove("up")) {
            if (!tilesSelected.includes(currentTile - 5) && !blockedTiles.includes(currentTile - 5)) {
                currentTile -= 5;
                tilesSelected.push(currentTile);
            }
        }
    }
    else if (e.key === "ArrowDown") {
        if (isAllowedToMove("down")) {
            if (!tilesSelected.includes(currentTile + 5) && !blockedTiles.includes(currentTile + 5)) {
                currentTile += 5;
                tilesSelected.push(currentTile);
            }
        }
    }
    else if (e.key === "ArrowLeft") {
        if (isAllowedToMove("left")) {
            if (!tilesSelected.includes(currentTile - 1) && !blockedTiles.includes(currentTile - 1)) {
                currentTile -= 1;
                tilesSelected.push(currentTile);
            }
        }
    }
    else if (e.key === "ArrowRight") {
        if (isAllowedToMove("right")) {
            if (!tilesSelected.includes(currentTile + 1) && !blockedTiles.includes(currentTile + 1)) {
                currentTile += 1;
                tilesSelected.push(currentTile);
            }
        }
    }
    else if (e.key === "Enter") {
        if (currentTile === 0) {
            isTrainDriving = true;
        }
    }
    else if (e.key === "Backspace") {
        currentTile = 20;
        tilesSelected = [];
        tilesSelected.push(20);
        trainPos = new Vec3(-22,3,26);
        trainRotY = 0;
        trainDestination = 20;
        trainDestinationIndex = 0;
        pan = 0;
        zoom = 70.0;
        isTrainDriving = false;
    }
});

// These variables are used by the draw calls.
// They will be updated in the render loop.
const viewPos = Vec3.zero();
const viewMatrix = Mat4.identity();

// =====================================================================
// Skybox
// =====================================================================

/// This is the same skybox shader from the VAO/skybox lecture.
const skyboxVSSource = `#version 300 es
    precision highp float;

    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;

    in vec3 a_pos;

    out vec3 f_texCoord;

    void main() {
        f_texCoord = a_pos;
        vec4 ndcPos = u_projectionMatrix * u_viewMatrix * vec4(a_pos, 0.0);
        gl_Position = ndcPos.xyww;
    }
`;
const skyboxFSSource = `#version 300 es
    precision mediump float;

    uniform samplerCube u_skybox;

    in vec3 f_texCoord;

    out vec4 o_fragColor;

    void main() {
        o_fragColor = texture(u_skybox, f_texCoord);
    }
`;
const skyboxShader = glance.createShader(gl,
    "skybox-shader",
    skyboxVSSource,
    skyboxFSSource,
    {
        u_skybox: 0, // read the skybox from texture unit 0
    }
);

/// Create the skybox geometry.
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

/// Load the skybox texture.
const skyboxTexture = await glance.loadCubemapNow(gl, "skybox-texture", [
    "Assets/Textures/Skybox/boilerroomRight.jpg",
    "Assets/Textures/Skybox/boilerroomLeft.jpg",
    "Assets/Textures/Skybox/boilerroomTop.jpg",
    "Assets/Textures/Skybox/boilerroomBottom.jpg",
    "Assets/Textures/Skybox/boilerroomFront.jpg",
    "Assets/Textures/Skybox/boilerroomBack.jpg",
]);

/// The draw call contains all information on how to render the skybox.
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

// =====================================================================
// World Shaders
// =====================================================================

const blinnPhongFSSource = `#version 300 es
	precision mediump float;

    /// World-space position of the camera.
    uniform vec3 u_viewPosition;

    /// Skybox texture (cubemap-)sampler
    uniform samplerCube u_skybox;

    /// Interpolated normal of the fragment in world-space.
    in vec3 f_normal;

    /// Interpolated position of the fragment in world-space.
    in vec3 f_position;

    /// Output color of the fragment.
	out vec4 o_fragColor;

	void main() {
        // Constants
        vec3 lightDirection = normalize(vec3(-1.0, 1.0, -1.0));
        float ambient = 0.07;   // Ambient intensity in range [0, 1]
        float shininess = 64.0; // Specular shininess

        vec3 normal = normalize(f_normal);
        vec3 viewDirection = normalize(u_viewPosition - f_position);
        vec3 halfWay = normalize(viewDirection + lightDirection);

        float diffuse = max(0.0, dot(normal, lightDirection));
        float specular = pow(max(0.0, dot(normal, halfWay)), shininess);

        float reflectionIntensity = 0.8;
        vec3 reflectionDirection = reflect(-viewDirection, normal);
        vec3 reflection = texture(u_skybox, reflectionDirection).rgb;

        o_fragColor = vec4(
            mix(
                vec3(ambient + diffuse + specular),
                reflection,
                reflectionIntensity
            ),
            1.0
        );
	}
`;


const blinnPhongVSSource = `#version 300 es
	precision highp float;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;

	in vec3 a_pos;
    in vec3 a_normal;

    out vec3 f_normal;
    out vec3 f_position;

    void main() {
        vec4 worldPosition = u_modelMatrix * vec4(a_pos, 1.0);
        f_position = worldPosition.xyz;
        f_normal = (u_modelMatrix * vec4(a_normal, 0.0)).xyz;

 		gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;
	}
`;

const trainShader = glance.createShader(
    gl,
    "shader-train",
    blinnPhongVSSource,
    blinnPhongFSSource,
    {
        u_skybox: 0,
    },
);


const worldVertexShader = `#version 300 es
    precision highp float;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;

    in vec3 a_pos;
    in vec3 a_normal;
    in vec2 a_texCoord;

    out vec3 f_worldPos;
    out vec3 f_normal;
    out vec2 f_texCoord;

    void main() {
        vec4 worldPosition = u_modelMatrix * vec4(a_pos, 1.0);
        f_worldPos = worldPosition.xyz;
        f_normal = (u_modelMatrix * vec4(a_normal, 0.0)).xyz;
        f_texCoord = a_texCoord;
        gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;
    }
`


const worldFragmentShader = `#version 300 es
    precision mediump float;

    uniform float u_ambient;
    uniform float u_specular;
    uniform float u_shininess;
    uniform vec3 u_lightDirection;
    uniform vec3 u_color;
    uniform vec3 u_viewPos;
    uniform sampler2D u_texAmbient;
    uniform sampler2D u_texDiffuse;
    uniform sampler2D u_texSpecular;

    in vec3 f_worldPos;
    in vec3 f_normal;
    in vec2 f_texCoord;

    out vec4 FragColor;

    void main() {

        // texture
        vec3 texAmbient = texture(u_texAmbient, f_texCoord).rgb;
        vec3 texDiffuse = texture(u_texDiffuse, f_texCoord).rgb;
        vec3 texSpecular = texture(u_texSpecular, f_texCoord).rgb;

        // ambient
        vec3 ambient = max(vec3(u_ambient), texAmbient) * texDiffuse;

        // diffuse
        vec3 normal = normalize(f_normal);
        float diffuseIntensity = max(dot(normal, u_lightDirection), 0.0);
        vec3 diffuse = diffuseIntensity * texDiffuse;

        // specular
        vec3 viewDir = normalize(u_viewPos - f_worldPos);
        vec3 halfWay = normalize(u_lightDirection + viewDir);
        float specularIntensity = pow(max(dot(normal, halfWay), 0.0), u_shininess);
        vec3 specular = (u_specular * specularIntensity) * texSpecular;

        // color
        vec3 endColor = vec3(ambient + diffuse + specular) * u_color;
        FragColor = vec4(endColor, 1.0);
    }
`
const worldShader = glance.createShader(gl, "world-shader", worldVertexShader, worldFragmentShader, {
    u_ambient: 0.1,
    u_specular: 0.6,
    u_shininess: 64,
    u_lightDirection: lightDirection,
    u_projectionMatrix: projectionMatrix,
    u_texAmbient: 0,
    u_texDiffuse: 1,
    u_texSpecular: 2,
});

// =====================================================================
// World Object Creation + Draw Calls
// =====================================================================

// tracks
const tracksGeo = glance.createBox("tracks-geo", { width: 10, height: 1, depth: 10,});
const tracksIBO = glance.createIndexBuffer(gl, tracksGeo.indices);
const tracksABO = glance.createAttributeBuffer(gl, "tracks-abo", {
    a_pos: { data: tracksGeo.positions, height: 3 },
    a_normal: { data: tracksGeo.normals, height: 3 },
    a_texCoord: { data: tracksGeo.texCoords, height: 2 },
});
const tracksVAO = glance.createVAO(gl, "tracks-vao", tracksIBO, glance.buildAttributeMap(worldShader, [tracksABO]));

const tracksTextureAmbient = glance.loadTexture(gl, 1024, 1024, "Assets/Textures/Objects/plywood_ao.jpg")
const tracksTextureDiffuse = glance.loadTexture(gl, 1024, 1024, "Assets/Textures/Objects/plywood_diff.jpg")
const tracksTextureSpecular = glance.loadTexture(gl, 1024, 1024, "Assets/Textures/Objects/plywood_diff.jpg")


// train
const trainGeo = glance.createBox("train-geo", { width: 10, height: 5, depth: 3,});
const trainIBO = glance.createIndexBuffer(gl, trainGeo.indices);
const trainABO = glance.createAttributeBuffer(gl, "train-abo", {
    a_pos: { data: trainGeo.positions, height: 3 },
    a_normal: { data: trainGeo.normals, height: 3 },
    a_texCoord: { data: trainGeo.texCoords, height: 2 },
});
const trainVAO = glance.createVAO(gl, "train-vao", trainIBO, glance.buildAttributeMap(trainShader, [trainABO]));

const trainDrawCall = glance.createDrawCall(gl, trainShader, trainVAO, {
    uniforms: {
        u_modelMatrix: () => Mat4.fromTranslation(trainPos).rotateY(trainRotY),
        u_viewMatrix: () => viewMatrix,
        u_projectionMatrix: () => projectionMatrix,
        u_viewPosition: () => viewPos,
    },
    textures: [[0, skyboxTexture]],
    cullFace: gl.BACK,
    depthTest: gl.LESS,
});

// =====================================================================
// Render Loop
// =====================================================================

const upVec = Vec3.yAxis();
let lastTime = -1;

setRenderLoop((time) => {
    const deltaTime = lastTime >= 0 ? time - lastTime : 0;
    lastTime = time;

    // Perform the draw calls
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    for (var [index, groundElement] of groundPosArr.entries()) {
        const tracksDrawCall = glance.createDrawCall(gl, worldShader, tracksVAO, {
            uniforms: {
                u_modelMatrix: () => Mat4.fromTranslation(groundElement),
                u_viewMatrix: () => viewMatrix,
                u_projectionMatrix: () => projectionMatrix,
                u_viewPos: () => viewPos,
                // The ground color changes according to the start/end station + set tracks
                u_color: () => {
                    switch (index) {
                        case 0: 
                            if (tilesSelected.includes(index)) {
                                return new Vec3(0.2, 0.9, 0.2);
                            }
                            return new Vec3(0.0, 0.0, 0.0);
                        case 20: return new Vec3(0.2, 0.9, 0.2);
                        default:
                            if (blockedTiles.includes(index)) {
                                return new Vec3(1.0, 0.2, 0.2);
                            }
                            else if (tilesSelected.includes(index)) {
                                return new Vec3(0.5, 0.5, 0.2);
                            }
                            return new Vec3(1.0, 1.0, 1.0)
                    }
                },
            },
            textures: [
                [0, tracksTextureAmbient],
                [1, tracksTextureDiffuse],
                [2, tracksTextureSpecular],
            ],
            cullFace: gl.BACK,
            depthTest: gl.LESS,
        });
        glance.performDrawCall(gl, tracksDrawCall, time);
    }
    glance.performDrawCall(gl, skyboxDrawCall, time);

    if (isTrainDriving) {
        if (trainDestination === 20) {
            trainDestinationIndex += 1;
            trainDestination = tilesSelected[trainDestinationIndex];
            // rotate train based on if x or z is about to change
            if (groundPosArr[trainDestination].x === Math.round(trainPos.x)) {
                trainRotY = Math.PI/2;
            }
            else if (groundPosArr[trainDestination].z === Math.round(trainPos.z)) {
                trainRotY = 0;
            }
        }
        trainPos.lerp(new Vec3(groundPosArr[trainDestination].x, 3, groundPosArr[trainDestination].z), deltaTime * trainSpeed);
        if (groundPosArr[trainDestination].equals(new Vec3(Math.round(trainPos.x), 0, Math.round(trainPos.z))) && trainDestination !== 0) {
            trainDestinationIndex += 1;
            trainDestination = tilesSelected[trainDestinationIndex];
            // rotate train based on if x or z is about to change
            if (groundPosArr[trainDestination].x === Math.round(trainPos.x)) {
                trainRotY = Math.PI/2;
            }
            else if (groundPosArr[trainDestination].z === Math.round(trainPos.z)) {
                trainRotY = 0;
            }
        }

        glance.performDrawCall(gl, trainDrawCall, time);
        viewPos.set(0, 0, zoom).rotateX(-Math.PI/8).rotateY(pan).add(cameraFocus);
    }
    else {
        viewPos.set(0, 0, zoom).rotateX(-Math.PI/2).add(cameraFocus);
    }
    viewMatrix.lookAt(viewPos, cameraFocus, upVec);
});

// Game Code End ///////////////////////////////////////////////////////////