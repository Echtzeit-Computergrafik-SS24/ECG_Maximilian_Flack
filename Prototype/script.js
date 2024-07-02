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
function onKeyUp(callback) {
    window.addEventListener("keyup", (e) => {
        callback(e);
    });
}

// Game Code Start /////////////////////////////////////////////////////////

// =====================================================================
// Game Constants
// =====================================================================

// Globals
const origin = Vec3.zero();
const up = Vec3.yAxis();

// Camera settings
const fov = Math.PI / 4;
const nearPlane = 0.4;
const farPlane = 200;
let cameraFocus = new Vec3(0, 0, 0);
const cameraSpeed = 0.007;
const zoomSpeed = 0.25;
const minZoom = 20;
const maxZoom = 100;
// Light settings
const lightProjection = Mat4.ortho(-50., 50., -50., 50., 1., 200.);
const lightRotationSpeed = 0.0002;
const lightTilt = 0.7;
// Game settings
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

let trainPos = new Vec3(-27.5,100,16.5);
let trainRotY = 0;
let trainDestination = 24;
let trainDestinationIndex = 0;

/// The user can select the tiles around the current one with the arrow keys
let currentTile = 24;
let tilesSelected = [24];
// Create array with a number of elements that are greater than the possibly laid down number of tiles so that in instancing, it doesn't have to take a new array but can change the values of this one
let tilesSelectedPlacing = [24];
for (let i = 1; i < groundPosArr.length; i++) {
    tilesSelectedPlacing.push(-1);
}
let blockedTiles = [2, 10, 18, 26];
let trainStationTiles = [6, 23, 32];
let allTrainStationTiles = [4, 6, 23, 24, 32];
let fuelTiles = [8, 20, 35];
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
    if (!isTrainDriving && fuelCount > 0) {
        if (e.key === "ArrowUp") {
            if (isAllowedToMove("up")) {
                if (!tilesSelected.includes(currentTile - 6) && !blockedTiles.includes(currentTile - 6)) {
                    // update current Tile based on move direction, push to array and update instancing array
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
    "Assets/Textures/Skybox/westernRight.png",
    "Assets/Textures/Skybox/westernLeft.png",
    "Assets/Textures/Skybox/westernTop.png",
    "Assets/Textures/Skybox/westernBottom.png",
    "Assets/Textures/Skybox/westernFront.png",
    "Assets/Textures/Skybox/westernBack.png",
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

const groundInstanceVertexShader = `#version 300 es
    precision highp float;

    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;
    uniform vec3 u_viewPos;
    uniform mat4 u_lightProjection;
    uniform vec3 u_lightPosition;
    uniform mat4 u_lightXform;
    uniform vec3 u_groundArr[36];

    in float a_instancePos;
    in vec3 a_pos;
    in vec3 a_normal;
    in vec2 a_texCoord;
    in vec3 a_tangent;

    out vec3 f_worldPos;
    out vec3 f_viewPos;
    out vec3 f_lightPos;
    out vec2 f_texCoord;
    out vec4 f_fragPosLS;

    mat4 buildTranslation(vec3 delta) {
        const float PI_2 = 1.57079632679489661923;
        return mat4(
            vec4(0.8, 0.0, 0.0, 0.0),
            vec4(0.0, cos(PI_2), -sin(PI_2), 0.0),
            vec4(0.0, sin(PI_2), cos(PI_2), 0.0),
            vec4(delta, 1.0)
        );
    }

    void main() {
        int id = int(a_instancePos);
        mat4 iPos = buildTranslation(u_groundArr[id]);
        
        vec3 normal = (iPos * vec4(a_normal, 0.0)).xyz;
        vec3 tangent = (iPos * vec4(a_tangent, 0.0)).xyz;
        vec3 bitangent = cross(normal, tangent);
        mat3 worldToTangent = transpose(mat3(tangent, bitangent, normal));

        vec4 worldPosition = iPos * vec4(a_pos, 1.0);
        
        // Transform world space coords to tangent space
        f_worldPos = worldToTangent * worldPosition.xyz;
        f_viewPos = worldToTangent * u_viewPos;
        f_lightPos = worldToTangent * u_lightPosition;

        f_texCoord = a_texCoord;

        gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;
        f_fragPosLS = u_lightProjection * u_lightXform * worldPosition;
    }
`
const trackFragmentShader = `#version 300 es
    precision mediump float;

    uniform float u_ambient;
    uniform float u_diffuse;
    uniform float u_specular;
    uniform float u_shininess;
    uniform vec3 u_lightColor;
    uniform sampler2D u_texDiffuse;
    uniform sampler2D u_texSpecular;
    uniform sampler2D u_texNormal;
    uniform sampler2D u_texDepth;
    uniform sampler2D u_texShadow;

    in vec3 f_worldPos;
    in vec3 f_viewPos;
    in vec3 f_lightPos;
    in vec2 f_texCoord;
    in vec4 f_fragPosLS;

    out vec4 FragColor;

    const float parallaxScale = 0.04;
    const float minLayers = 16.0;
    const float maxLayers = 64.0;

    vec2 parallax_mapping(vec3 viewDir) {
        float numLayers = mix(maxLayers, minLayers, smoothstep(0.0, 1.0, max(dot(vec3(0.0, 0.0, 1.0), viewDir), 0.0)));
        vec2 texCoordsDelta   = (viewDir.xy * parallaxScale) / (viewDir.z * numLayers);

        vec2  currentTexCoords     = f_texCoord;
        float currentDepthMapValue = 1.0 - texture(u_texDepth, currentTexCoords).r;
        float prevDepthMapValue    = currentDepthMapValue;

        float i = 0.0;
        for(;i / numLayers < currentDepthMapValue; i += 1.0)
        {
            prevDepthMapValue    = currentDepthMapValue;
            currentTexCoords    -= texCoordsDelta;
            currentDepthMapValue = 1.0 - texture(u_texDepth, currentTexCoords).r;
        }

        // get depth after and before collision for linear interpolation
        float afterDepth  = currentDepthMapValue - i / numLayers;
        float beforeDepth = prevDepthMapValue - max(i - 1.0, 0.0) / numLayers;

        float fraction = afterDepth / (afterDepth - beforeDepth);
        return currentTexCoords + (texCoordsDelta * fraction);
    }

    float calculateShadow() {
        // Perspective divide.
        vec3 projCoords = f_fragPosLS.xyz / f_fragPosLS.w;

        // Transform to [0,1] range.
        projCoords = projCoords * 0.5 + 0.5;

        // No shadow for fragments outside of the light's frustum.
        if(any(lessThan(projCoords, vec3(0))) || any(greaterThan(projCoords, vec3(1)))){
            return 1.0;
        }

        float bias = 0.002;
        float closestDepth = texture(u_texShadow, projCoords.xy).r;
        return projCoords.z - bias > closestDepth  ? 0.0 : 1.0;
    }

    void main() {
        // parallax
        vec3 viewDir = normalize(f_viewPos - f_worldPos);
        vec2 texCoord = parallax_mapping(viewDir);
        if(texCoord.x > 1.0
            || texCoord.y > 1.0
            || texCoord.x < 0.0
            || texCoord.y < 0.0) {
            discard;
        }

        // texture
        vec3 texDiffuse = texture(u_texDiffuse, texCoord).rgb;
        vec3 texSpecular = texture(u_texSpecular, texCoord).rgb;
        vec3 texNormal = texture(u_texNormal, texCoord).rgb;

        // lighting
        vec3 normal = normalize(texNormal * (255./128.) - 1.0);
        vec3 lightDir = normalize(f_lightPos - f_worldPos);
        vec3 halfWay = normalize(viewDir + lightDir);

        // ambient
        vec3 ambient = texDiffuse * u_ambient;

        // diffuse
        float diffuseIntensity = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = texDiffuse * texSpecular * diffuseIntensity * u_lightColor * u_diffuse;

        // specular
        float specularIntensity = pow(max(dot(normal, halfWay), 0.0), u_shininess);
        vec3 specular = texSpecular * specularIntensity * u_lightColor * u_specular;

        // shadow
        float shadow = calculateShadow();

        // color
        vec3 endColor = vec3(ambient + shadow * (diffuse + specular));
        FragColor = vec4(endColor, 1.0);
    }
`

const instanceVertexShader = `#version 300 es
    precision highp float;

    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;
    uniform mat4 u_lightProjection;
    uniform vec3 u_lightPosition;
    uniform mat4 u_lightXform;
    uniform vec3 u_groundArr[36];
    // type of building that is being created 1=ground, 2=tree, 3=station, 4=fueltank, 5=track
    uniform float u_type;

    in float a_instancePos;
    in vec3 a_pos;
    in vec3 a_normal;
    in vec2 a_texCoord;

    out vec3 f_normal;
    out vec3 f_worldPos;
    out vec2 f_texCoord;
    out vec3 f_lightDir;
    out vec4 f_fragPosLS;

    mat4 buildTranslation(vec3 delta) {
        if (u_type == 1.0) {
            return mat4(
                vec4(1.0, 0.0, 0.0, 0.0),
                vec4(0.0, 1.0, 0.0, 0.0),
                vec4(0.0, 0.0, 1.0, 0.0),
                vec4(delta, 1.0)
            );
        }
        if (u_type == 2.0) {
            return mat4(
                vec4(1.0, 0.0, 0.0, 0.0),
                vec4(0.0, 1.0, 0.0, 0.0),
                vec4(0.0, 0.0, 1.0, 0.0),
                vec4(delta.x, 0.5, delta.z, 1.0)
            );
        }
        if (u_type == 3.0) {
            return mat4(
                vec4(0.6, 0.0, 0.0, 0.0),
                vec4(0.0, 0.8, 0.0, 0.0),
                vec4(0.0, 0.0, 0.6, 0.0),
                vec4(delta.x, 1.0, delta.z, 1.0)
            );
        }
        if (u_type == 4.0) {
            return mat4(
                vec4(0.6, 0.0, 0.0, 0.0),
                vec4(0.0, 0.8, 0.0, 0.0),
                vec4(0.0, 0.0, 0.6, 0.0),
                vec4(delta.x, 1.0, delta.z, 1.0)
            );
        }
        if (u_type == 5.0) {
            // because instancing array of the tracks has a lot of elements with the id -1, move those out of sight
            if (a_instancePos == -1.0) {
                return mat4(
                    vec4(2.0, 0.0, 0.0, 0.0),
                    vec4(0.0, 2.0, 0.0, 0.0),
                    vec4(0.0, 0.0, 2.0, 0.0),
                    vec4(delta.x, 400, delta.z, 1.0)
                );
            } 
            else {
                return mat4(
                    vec4(2.0, 0.0, 0.0, 0.0),
                    vec4(0.0, 2.0, 0.0, 0.0),
                    vec4(0.0, 0.0, 2.0, 0.0),
                    vec4(delta.x, 0.5, delta.z, 1.0)
                );
            }
        }
    }

    void main() {
        int id = int(a_instancePos);
        mat4 iPos = buildTranslation(u_groundArr[id]);
        vec4 worldPosition = iPos * vec4(a_pos, 1.0);
        f_worldPos = worldPosition.xyz;
        f_normal = (iPos * vec4(a_normal, 0.0)).xyz;
        f_texCoord = a_texCoord;
        f_lightDir = normalize(u_lightPosition);

        gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;
        f_fragPosLS = u_lightProjection * u_lightXform * worldPosition;
    }
`

const trainVSSource = `#version 300 es
    precision highp float;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;
    uniform mat4 u_lightProjection;
    uniform vec3 u_lightPosition;
    uniform mat4 u_lightXform;

    in vec3 a_pos;
    in vec3 a_normal;
    in vec2 a_texCoord;

    out vec3 f_normal;
    out vec3 f_worldPos;
    out vec2 f_texCoord;
    out vec3 f_lightDir;
    out vec4 f_fragPosLS;

    void main() {
        vec4 worldPosition = u_modelMatrix * vec4(a_pos, 1.0);
        f_worldPos = worldPosition.xyz;
        f_normal = (u_modelMatrix * vec4(a_normal, 0.0)).xyz;
        f_texCoord = a_texCoord;
        f_lightDir = normalize(u_lightPosition);

        gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;
        f_fragPosLS = u_lightProjection * u_lightXform * worldPosition;
    }
`;

const trainFSSource = `#version 300 es
    precision mediump float;

    uniform vec3 u_viewPos;
    uniform sampler2D u_texDiffuse;
    uniform sampler2D u_texShadow;

    in vec3 f_normal;
    in vec3 f_worldPos;
    in vec2 f_texCoord;
    in vec3 f_lightDir;
    in vec4 f_fragPosLS;

    out vec4 o_fragColor;

    float calculateShadow() {
        // Perspective divide.
        vec3 projCoords = f_fragPosLS.xyz / f_fragPosLS.w;

        // Transform to [0,1] range.
        projCoords = projCoords * 0.5 + 0.5;

        // No shadow for fragments outside of the light's frustum.
        if(any(lessThan(projCoords, vec3(0))) || any(greaterThan(projCoords, vec3(1)))){
            return 1.0;
        }

        float bias = 0.002;
        float closestDepth = texture(u_texShadow, projCoords.xy).r;
        return projCoords.z - bias > closestDepth  ? 0.0 : 1.0;
    }

    void main() {
        vec3 texDiffuse = texture(u_texDiffuse, f_texCoord).rgb;
        vec3 normal = normalize(f_normal);
        vec3 viewDirection = normalize(u_viewPos - f_worldPos);
        vec3 halfWay = normalize(viewDirection + f_lightDir);

        vec3 ambient = 0.4 * texDiffuse;
        float diffuseIntensity = max(0.0, dot(normal, f_lightDir)) * 1.0;
        vec3 diffuse = diffuseIntensity * texDiffuse;
        float specular = pow(max(0.0, dot(normal, halfWay)), 64.0) * 1.0;

        // shadow
        float shadow = calculateShadow();

        // color
        vec3 endColor = vec3(ambient + shadow * (diffuse + specular));
        o_fragColor = vec4(endColor, 1.0);
    }
`;

const trackShader = glance.createShader(gl, "world-shader", groundInstanceVertexShader, trackFragmentShader, {
    u_ambient: 0.2,
    u_diffuse: 0.9,
    u_specular: 0.4,
    u_shininess: 128,
    u_lightColor: [1, 1, 1],
    u_texDiffuse: 0,
    u_texSpecular: 1,
    u_texNormal: 2,
    u_texDepth: 3,
    u_texShadow: 4,
    u_lightProjection: lightProjection,
});

const worldObjectsShader = glance.createShader(gl, "world-objects-shader", instanceVertexShader, trainFSSource, {
    u_texDiffuse: 0,
    u_texShadow: 1,
    u_lightProjection: lightProjection,
});

const trainShader = glance.createShader(gl, "train-shader", trainVSSource, trainFSSource, {
    u_texDiffuse: 0,
    u_texShadow: 1,
    u_lightProjection: lightProjection,
});



    // =====================================================================
    // Debug Screen
    // =====================================================================

    const debugShader = glance.createShader(gl, "debug-shader",
        `#version 300 es
    precision highp float;
    in vec2 a_pos;
    in vec2 a_texCoord;
    out vec2 f_texCoord;
    void main() {
        f_texCoord = a_texCoord;
        gl_Position = vec4(a_pos, 0.0, 1.0);
    }
`, `#version 300 es
    precision mediump float;
    uniform sampler2D u_texture;
    in vec2 f_texCoord;
    out vec4 o_fragColor;
    void main() {
        o_fragColor = vec4(vec3(texture(u_texture, f_texCoord).r), 1.0);
    }
`, {
        u_texture: 0,
    });

    const debugGeo = glance.createScreenQuat("debug-geo", {
        in2D: true,
    });
    const debugIBO = glance.createIndexBuffer(gl, debugGeo.indices);
    const debugABO = glance.createAttributeBuffer(gl, "debug-abo", {
        a_pos: { data: debugGeo.positions, height: 2 },
        a_texCoord: { data: debugGeo.texCoords, height: 2 },
    });
    const debugVAO = glance.createVAO(gl, "debug-vao", debugIBO, glance.buildAttributeMap(debugShader, debugABO));

    const debugDrawCall = glance.createDrawCall(gl, debugShader, debugVAO, {
        textures: [[0, shadowDepthTexture]],
        cullFace: gl.NONE,
        depthTest: gl.NONE,
    });



// =====================================================================
// World Objects
// =====================================================================

// Ground

const tracksGeo = glance.createPlane("tracks-geo", { width: 6, height: 5});

const tracksIBO = glance.createIndexBuffer(gl, tracksGeo.indices);
const tracksABO = glance.createAttributeBuffer(gl, "tracks-abo", {
    a_pos: { data: tracksGeo.positions, height: 3 },
    a_normal: { data: tracksGeo.normals, height: 3 },
    a_texCoord: { data: tracksGeo.texCoords, height: 2 },
    a_tangent: { data: tracksGeo.tangents, height: 3 },
});
const tracksIABO = glance.createAttributeBuffer(gl, "tracks-iabo", {
    a_instancePos: { data: groundPosArrIds, height: 1, divisor: 1 },
});

const tracksVAO = glance.createVAO(gl, "tracks-vao", tracksIBO, glance.buildAttributeMap(trackShader, [tracksABO, tracksIABO]));

const tracksTextureDiffuse = glance.loadTexture(gl, 1024, 1024, "Assets/Textures/Objects/gray_rocks_diff_1k.png");
const tracksTextureSpecular = glance.loadTexture(gl, 1024, 1024, "Assets/Textures/Objects/gray_rocks_ao_1k.png");
const tracksTextureNormal = glance.loadTexture(gl, 1024, 1024, "Assets/Textures/Objects/gray_rocks_nor_gl_1k.png");
const tracksTextureDepth = glance.loadTexture(gl, 1024, 1024, "Assets/Textures/Objects/gray_rocks_disp_1k.png");

const tracksDrawCall = glance.createDrawCall(gl, trackShader, tracksVAO, {
    uniforms: {
        u_viewMatrix: () => viewMatrix,
        u_projectionMatrix: () => projectionMatrix,
        u_viewPos: () => viewPos,
        u_lightPosition: () => lightParallaxPos,
        u_lightXform: () => lightXform,
        u_groundArr: () => groundPosArrFlat,

    },
    textures: [
        [0, tracksTextureDiffuse],
        [1, tracksTextureSpecular],
        [2, tracksTextureNormal],
        [3, tracksTextureDepth],
        [4, shadowDepthTexture]
    ],
    cullFace: gl.BACK,
    depthTest: gl.LESS,
    instances: () => groundPosArrIds.length,
    enabled: () => groundPosArrIds.length > 0,
});

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

const treeTexture = glance.loadTexture(gl, 1024, 1024, "Assets/OBJ/tree.png");

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

const stationTexture = glance.loadTexture(gl, 512, 512, "Assets/OBJ/wood.png");

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

const fuelTexture = glance.loadTexture(gl, 1024, 1024, "Assets/OBJ/tower.png");

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

// Train Tracks

const trainTrackGeo = await glance.loadObj("Assets/OBJ/track.obj");
const trainTrackIBO = glance.createIndexBuffer(gl, trainTrackGeo.indices);
const trainTrackABO = glance.createAttributeBuffer(gl, "trainTrack-abo", {
    a_pos: { data: trainTrackGeo.positions, height: 3 },
    a_normal: { data: trainTrackGeo.normals, height: 3 },
    a_texCoord: { data: trainTrackGeo.texCoords, height: 2 },
});

const trainTrackTexture = glance.loadTexture(gl, 1024, 1024, "Assets/OBJ/track.png");

const trainTrackIABO = glance.createAttributeBuffer(gl, "trainTrack-iabo", {
    a_instancePos: { data: tilesSelectedPlacing, height: 1, divisor: 1 },
});

const trainTrackVAO = glance.createVAO(gl, "trainTrack-vao", trainTrackIBO, glance.buildAttributeMap(worldObjectsShader, [trainTrackABO, trainTrackIABO]));

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

// Goal Flag

const flagGeo = await glance.loadObj("Assets/OBJ/flag.obj");
const flagIBO = glance.createIndexBuffer(gl, flagGeo.indices);
const flagABO = glance.createAttributeBuffer(gl, "flag-abo", {
    a_pos: { data: flagGeo.positions, height: 3 },
    a_normal: { data: flagGeo.normals, height: 3 },
    a_texCoord: { data: flagGeo.texCoords, height: 2 },
});

const flagVAO = glance.createVAO(gl, "flag-vao", flagIBO, glance.buildAttributeMap(trainShader, [flagABO]));

const flagTexture = glance.loadTexture(gl, 512, 512, "Assets/OBJ/tree.png");

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

// Train Cars

const trainGeo = await glance.loadObj("Assets/OBJ/Train.obj");
const trainIBO = glance.createIndexBuffer(gl, trainGeo.indices);
const trainABO = glance.createAttributeBuffer(gl, "train-abo", {
    a_pos: { data: trainGeo.positions, height: 3 },
    a_normal: { data: trainGeo.normals, height: 3 },
    a_texCoord: { data: trainGeo.texCoords, height: 2 },
});

const trainVAO = glance.createVAO(gl, "train-vao", trainIBO, glance.buildAttributeMap(trainShader, [trainABO]));

const trainTexture = glance.loadTexture(gl, 2048, 2048, "Assets/OBJ/TrainBake.png");

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
});

const groundVAO = glance.createVAO(gl, "ground-vao", groundIBO, glance.buildAttributeMap(trainShader, [groundABO]));

const groundDrawCall = glance.createDrawCall(gl, trainShader, groundVAO, {
    uniforms: {
        u_modelMatrix: () => Mat4.identity(),
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

// =====================================================================
// Shadow Mapping
// =====================================================================

const shadowVSSource = `#version 300 es
    precision highp float;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_lightXform;
    uniform mat4 u_lightProjection;

    in vec3 a_pos;

    void main()
    {
        gl_Position = u_lightProjection * u_lightXform * u_modelMatrix * vec4(a_pos, 1.0);
    }
`;

const shadowInstanceVSSource = `#version 300 es
    precision highp float;

    uniform mat4 u_lightXform;
    uniform mat4 u_lightProjection;
    uniform vec3 u_groundArr[36];
    // type of building that is being created 1=ground, 2=tree, 3=station, 4=fueltank, 5=track
    uniform float u_type;

    in float a_instancePos;
    in vec3 a_pos;

    mat4 buildTranslation(vec3 delta) {
        const float PI_2 = 1.57079632679489661923;
        if (u_type == 1.0) {
            return mat4(
                vec4(1.0, 0.0, 0.0, 0.0),
                vec4(0.0, 1.0, 0.0, 0.0),
                vec4(0.0, 0.0, 1.0, 0.0),
                vec4(delta, 1.0)
            );
        }
        if (u_type == 2.0) {
            return mat4(
                vec4(1.0, 0.0, 0.0, 0.0),
                vec4(0.0, 1.0, 0.0, 0.0),
                vec4(0.0, 0.0, 1.0, 0.0),
                vec4(delta.x, 0.5, delta.z, 1.0)
            );
        }
        if (u_type == 3.0) {
            return mat4(
                vec4(0.6, 0.0, 0.0, 0.0),
                vec4(0.0, 0.8, 0.0, 0.0),
                vec4(0.0, 0.0, 0.6, 0.0),
                vec4(delta.x, 1.0, delta.z, 1.0)
            );
        }
        if (u_type == 4.0) {
            return mat4(
                vec4(0.6, 0.0, 0.0, 0.0),
                vec4(0.0, 0.8, 0.0, 0.0),
                vec4(0.0, 0.0, 0.6, 0.0),
                vec4(delta.x, 1.0, delta.z, 1.0)
            );
        }
        if (u_type == 5.0) {
            // because instancing array of the tracks has a lot of elements with the id -1, move those out of sight
            if (a_instancePos == -1.0) {
                return mat4(
                    vec4(2.0, 0.0, 0.0, 0.0),
                    vec4(0.0, 2.0, 0.0, 0.0),
                    vec4(0.0, 0.0, 2.0, 0.0),
                    vec4(delta.x, 400, delta.z, 1.0)
                );
            } 
            else {
                return mat4(
                    vec4(2.0, 0.0, 0.0, 0.0),
                    vec4(0.0, 2.0, 0.0, 0.0),
                    vec4(0.0, 0.0, 2.0, 0.0),
                    vec4(delta.x, 0.5, delta.z, 1.0)
                );
            }
        }
    }


    void main()
    {
        int id = int(a_instancePos);
        mat4 iPos = buildTranslation(u_groundArr[id]);
        gl_Position = u_lightProjection * u_lightXform * iPos * vec4(a_pos, 1.0);
    }
`;

const shadowFSSource = `#version 300 es
    precision mediump float;

    void main() {}
`;

const shadowShader = glance.createShader(gl, "shadow-shader", shadowVSSource, shadowFSSource, {
    u_lightProjection: lightProjection,
});

const shadowInstanceShader = glance.createShader(gl, "shadow-instance-shader", shadowInstanceVSSource, shadowFSSource, {
    u_lightProjection: lightProjection,
});

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
];


// =====================================================================
// Post Plane
// =====================================================================

const postVSSource = `#version 300 es
    precision highp float;

    in vec2 a_pos;
    in vec2 a_texCoord;

    out vec2 f_texCoord;

    void main()
    {
        f_texCoord = a_texCoord;
        gl_Position = vec4(a_pos, 0.0, 1.0);
    }
`;

const postFSSource = `#version 300 es
    precision mediump float;

    uniform sampler2D u_texture;
    uniform sampler2D u_textLayer;
    uniform vec3 u_color;

    in vec2 f_texCoord;

    out vec4 o_fragColor;

    // create gaussian blur
    vec3 gaussian(in sampler2D tex) {
        vec2 res = vec2(800, 800);
        float Pi = 6.28318530718; // Pi*2
    
        // GAUSSIAN BLUR SETTINGS {{{
        float Directions = 16.0; // BLUR DIRECTIONS (Default 16.0 - More is better but slower)
        float Quality = 3.0; // BLUR QUALITY (Default 4.0 - More is better but slower)
        float Size = 8.0; // BLUR SIZE (Radius)
        // GAUSSIAN BLUR SETTINGS }}}
    
        vec2 Radius = Size/res.xy;
        
        // Normalized pixel coordinates (from 0 to 1)
        vec2 uv = gl_FragCoord.xy/res.xy;

        // Pixel colour
        vec4 Color = texture(tex, uv);
        
        // Blur calculations
        for (float d=0.0; d<Pi; d+=Pi/Directions)
        {
            for (float i=1.0/Quality; i<=1.001; i+=1.0/Quality)
            {
                Color += texture(tex, uv+vec2(cos(d),sin(d))*Radius*i);		
            }
        }
        Color /= Quality * Directions + 1.0;
        return Color.xyz;
    }

    void main() {
        vec3 color = gaussian(u_texture);
        float factor = texture(u_textLayer, f_texCoord).g;
        color = factor * color * u_color;
        o_fragColor = vec4(color, 1.0);
    }
`;

const postShader = glance.createShader(gl, "post-shader", postVSSource, postFSSource, {
    u_texture: 0,
    u_textLayer: 1,
});

const postGeo = glance.createScreenQuat("post-geo", {
    in2D: true,
});

const postIBO = glance.createIndexBuffer(gl, postGeo.indices);
const postABO = glance.createAttributeBuffer(gl, "post-abo", {
    a_pos: { data: postGeo.positions, height: 2 },
    a_texCoord: { data: postGeo.texCoords, height: 2 },
});
const postVAO = glance.createVAO(gl, "post-vao", postIBO, glance.buildAttributeMap(postShader, [postABO]));

const winTextTexture = glance.loadTexture(gl, 800, 800, "./Assets/Style/win-stencil.png");
const loseTextTexture = glance.loadTexture(gl, 800, 800, "./Assets/Style/lose-stencil.png");

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

// =============================================================================
// Post Framebuffer
// =============================================================================

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

    // add Post Framebuffer if end is reached
    if (gameFinished && 1==2) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, postFramebuffer);
    }
    else {
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
    }


    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // glance.performDrawCall(gl, debugDrawCall, time);
    glance.performDrawCall(gl, skyboxDrawCall, time);
    glance.performDrawCall(gl, tracksDrawCall, time);
    glance.performDrawCall(gl, treeDrawCall, time);
    glance.performDrawCall(gl, stationDrawCall, time);
    glance.performDrawCall(gl, fuelDrawCall, time);
    glance.performDrawCall(gl, trainTrackDrawCall, time);
    glance.performDrawCall(gl, flagDrawCall, time);
    glance.performDrawCall(gl, groundDrawCall, time);

    if (isTrainDriving) {
        document.getElementById("fuel-counter-div").style.display = "none";
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
        else if (trainDestination === 4) {
            // rotate train based on current and next tile index in groundPosArr
            if (tilesSelected[trainDestinationIndex-1] < tilesSelected[trainDestinationIndex]) {
                trainRotY = 1.5*Math.PI;
            }
            else if (tilesSelected[trainDestinationIndex-1] > tilesSelected[trainDestinationIndex]) {
                trainRotY = 0.5*Math.PI;
            }
        }
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

        trainPos.lerp(new Vec3(groundPosArr[trainDestination].x, 1, groundPosArr[trainDestination].z), deltaTime * trainSpeed);
        glance.performDrawCall(gl, trainDrawCall, time);

        cameraFocus = trainPos;
        viewPos.set(0, 0, zoom).rotateX(-Math.PI/8).rotateY(pan).add(cameraFocus);
    }
    else {
        viewPos.set(0, 0, zoom).rotateX(-Math.PI/2).add(cameraFocus);
    }
    viewMatrix.lookAt(viewPos, cameraFocus, up);

    // update the fuelcount
    document.getElementById("fuel-counter-span").textContent = fuelCount;

    if (gameFinished && 1==2) {
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