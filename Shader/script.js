// Boilerplate code ////////////////////////////////////////////////////////

// Get the WebGL context
const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl2');

// get cursor position on mousemove
const cursor = [0, 0]
canvas.addEventListener('mousemove', (event) =>
{
    cursor[0] = (event.offsetX / canvas.width) * 4 - 2
    cursor[1] = (event.offsetY / canvas.height) * -2 + 1
})

// Basic render loop wrapper.
function setRenderLoop(callback) {
    function renderLoop(time) {
        callback(time);
        requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);
}

// Your code ///////////////////////////////////////////////////////////////

// 1. Data /////////////////////////////////////////////////////////////////

// Define the vertex positions of a triangle as a flat buffer of 2d
// coordinates in a space ranging from -1 to +1 in both X and Y.
const vertexPositions = new Float32Array([
    -1.0, -1.0, // bottom left
    +1.0, -1.0, // bottom right
    -1.0, +1.0, // top left
    +1.0, +1.0, // top right
]);

// Create the position buffer in WebGL...
const positionBuffer = gl.createBuffer();
// ... bind it to the ARRAY_BUFFER target ...
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
// ... and upload the data to it.
gl.bufferData(gl.ARRAY_BUFFER, vertexPositions, gl.STATIC_DRAW);


// Face indices define triangles, the index number corresponds to
// a vertex defined in the bound ARRAY_BUFFER target.
const faceIndices = new Uint16Array([
    0, 1, 2, // first triangle
    1, 3, 2, // second triangle
]);

// Upload the indices to a buffer bound on the ELEMENT_ARRAY_BUFFER
// target.
const indexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, faceIndices, gl.STATIC_DRAW);

// 2. Shader ///////////////////////////////////////////////////////////////

// Define the Vertex Shader Source, ignoring the details for now.
const vertexShaderSource = `#version 300 es
precision highp float;

in vec2 a_pos; // <-- This is where we want our 2D coordinates to go

void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Create the vertex shader object in WebGL...
const vertexShader = gl.createShader(gl.VERTEX_SHADER);
// ... upload the source into the shader ...
gl.shaderSource(vertexShader, vertexShaderSource);
// ... and compile the shader. We ignore potential errors here.
gl.compileShader(vertexShader);


// Define the Fragment Shader Source.
const fragmentShaderSource = `#version 300 es
precision mediump float;

uniform float u_time;
uniform float u_height;
uniform float u_width;
uniform vec2 u_cursor;

vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.263, 0.416, 0.557);

    return a + b*cos(6.28318*(c*t+d));
}

float randomPattern(vec2 st, float time) {
    float scale = 50.0; 
    float speed = 25.0; 
    vec2 p = st * scale;
    float pattern = sin(p.x + p.y + time * speed) * 1.0 + 0.8;
    return pattern;
}

float circle(in vec2 _st, in float _radius) {
    vec2 dist = _st + vec2(0.0, 5.0);

    float insideCircle = 1.0 - smoothstep(_radius - (_radius * 0.01), _radius + (_radius * 0.01), dot(dist, dist) * 4.0);

    float pattern = randomPattern(_st, u_time) * insideCircle;

    return insideCircle * pattern;
}

out vec4 o_fragColor;

void main() {
    vec2 res = vec2(u_width, u_height);
    vec2 uv = (gl_FragCoord.xy * 2.0 - res.xy) / res.y;
    vec2 delta = uv - u_cursor;

    vec3 finColor = mix(vec3(1.0, 0.4, 0.1), vec3(1.0, 0.8, 0.3), uv.y);

    float r = 0.4;

    float insideCursor = 1.0 - smoothstep(r, r+0.1, dot(delta, delta) * 4.0);

    for (float i = 0.0; i < 4.0; i++) {
        delta = fract(delta * 1.5) - 0.5;

        float d = length(delta);

        vec3 color = palette(length(delta) + i*0.4 + u_time*2.0);

        d = sin(d * 10.0 + u_time)/10.0;
        d = abs(d);

        d = pow(0.01 / d, 1.2);

        finColor += insideCursor * d * color;
    }

    finColor += circle(uv, 80.0) * vec3(0.2, 0.2, 1.0);

    vec2 palmPos = uv + vec2(1.2, -0.2);
    float rPalm = 0.1 + 0.4 * cos(atan(palmPos.y, palmPos.x) * 10.0 + 20.0 * palmPos.x + 1.0);

    finColor *= smoothstep(rPalm, rPalm + 0.008, length(palmPos));

    rPalm = 0.02;
    rPalm += 0.002 * cos(120.0 * palmPos.y);
    finColor *= 1.0 - (1.0 - smoothstep(rPalm, rPalm + 0.008, abs(palmPos.x - 0.25 * sin(2.0 * palmPos.y)))) * (1.0 - smoothstep(0.0, 0.01, palmPos.y));

    o_fragColor = vec4(finColor, 1.0);
}
`;


// Compile the fragment shader in WebGL.
const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(fragmentShader, fragmentShaderSource);
gl.compileShader(fragmentShader);


// In order to use them, we have to link the two shaders together into
// a Shader Program.
// Create one first,
const shaderProgram = gl.createProgram();
// attach the two shaders (the order of attachment does not matter),
gl.attachShader(shaderProgram, vertexShader);
gl.attachShader(shaderProgram, fragmentShader);
// link the program, also ignoring errors
gl.linkProgram(shaderProgram);
// ... and tell WebGL to use the program for all future draw calls,
// or at least until we tell it to use another program instead.
gl.useProgram(shaderProgram);

// 3. Attribute Mapping ////////////////////////////////////////////////////

// So far, we've given WebGL a buffer of numbers and a shader that takes
// a vec2 as input. We now need to tell WebGL how to get the 2D
// coordinates out of the buffer, so the shader can use them.

// First, get the "attribute" (vertex shader input) location from the
// shader, so we can address it
const vertexAttribute = gl.getAttribLocation(shaderProgram, 'a_pos');
// We need to enable the attribute location (ignore this for now).
gl.enableVertexAttribArray(vertexAttribute);
// Here we tell WebGL how it can extract the attribute from the buffer
// bound on the ARRAY_BUFFER target.
gl.vertexAttribPointer(
    vertexAttribute, // We want to define the 'a_pos' attribute
    2,               // It has two components (x, y)
    gl.FLOAT,        // We are using a 32bit float to store the number
    false,           // It is not normalized (ignore this)
    8,               // Stride in bytes (see below)
    0                // Offset in bytes (see below)
);
// The Stride is the width of a vertex in the ARRAY_BUFFER.
// In this case we only have 2 components à 4 bytes = 8.
// The Offset is the offset of *this* particular attribute within the
// width of the vertex.
// If we had two 2D attributes, the Stride would be 16 for both,
// and the second attribute would have an Offset of 8.

// 4. Rendering ////////////////////////////////////////////////////////////

// Get the location of the uniform from the shader so we can address it
const timeUniform = gl.getUniformLocation(shaderProgram, "u_time");
const heightUniform = gl.getUniformLocation(shaderProgram, "u_height");
const widthUniform = gl.getUniformLocation(shaderProgram, "u_width");
const cursorUniform = gl.getUniformLocation(shaderProgram, "u_cursor")

gl.uniform1f(heightUniform, gl.drawingBufferHeight);
gl.uniform1f(widthUniform, gl.drawingBufferWidth);

function myRenderLoop(time) {
    // Update the uniform's value
    gl.uniform1f(timeUniform, time/2000.0);
    gl.uniform2f(cursorUniform, cursor[0], cursor[1]);
    
    /// Draw the triangle.
    gl.drawElements(
        gl.TRIANGLES,       // We want to draw triangles (always use this)
        6,                  // Draw 3 vertices from the index buffer
        gl.UNSIGNED_SHORT,  // Data type used in the index buffer
        0                   // Offset (in bytes) in the index buffer
    );

    // Stop the loop if an error occurred
    const error = gl.getError();
    if (error !== gl.NO_ERROR)
    {
        throw new Error(`WebGL error: ${error}`);
    }
}
setRenderLoop(myRenderLoop);