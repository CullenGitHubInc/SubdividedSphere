const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl");

if (!gl) {
    alert("WebGL not supported");
}

// Vertex shader program
const vertexShaderSource = `
    attribute vec4 aPosition;
    attribute vec4 aColor;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    varying vec4 vColor;

    void main(void) {
        gl_Position = uProjectionMatrix * uModelViewMatrix * aPosition;
        vColor = aColor;
    }
`;

// this is for the fragment shader program
const fragmentShaderSource = `
    precision mediump float;
    varying vec4 vColor;

    void main(void) {
        gl_FragColor = vColor;
    }
`;

// compiling shaders
function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Error compiling shader:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// initializing shaders
function initShaderProgram(gl) {
    const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error("Error linking shader program:", gl.getProgramInfoLog(shaderProgram));
        return null;
    }
    return shaderProgram;
}

const shaderProgram = initShaderProgram(gl);
gl.useProgram(shaderProgram);

const programInfo = {
    attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aPosition'),
        vertexColor: gl.getAttribLocation(shaderProgram, 'aColor'),
    },
    uniformLocations: {
        modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
        projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
    },
};

// this is to make sure we define initial vertices for a tetrahedron so it can approximate the sphere when subdivided
const va = [0.0, 0.0, -1.0];
const vb = [0.0, 0.942809, 0.333333];
const vc = [-0.816497, -0.471405, 0.333333];
const vd = [0.816497, -0.471405, 0.333333];

let positions = [];
let colors = [];
let numTimesToSubdivide = 6;  // Increase for finer approximation

// this is to initialize variables for ithe interaction
let rotationX = 0;
let rotationY = 0;
let isDragging = false;
let previousMouseX = 0;
let previousMouseY = 0;

// functions for generating the sphere
function initSphere() {
    positions = [];
    colors = [];
    tetrahedron(va, vb, vc, vd, numTimesToSubdivide);
    loadBuffers();
    render();
}

function tetrahedron(a, b, c, d, n) {
    divideTriangle(a, b, c, n);
    divideTriangle(d, c, b, n);
    divideTriangle(a, d, b, n);
    divideTriangle(a, c, d, n);
}

function divideTriangle(a, b, c, count) {
    if (count > 0) {
        const ab = normalize(mix(a, b, 0.5));
        const ac = normalize(mix(a, c, 0.5));
        const bc = normalize(mix(b, c, 0.5));

        divideTriangle(a, ab, ac, count - 1);
        divideTriangle(ab, b, bc, count - 1);
        divideTriangle(bc, c, ac, count - 1);
        divideTriangle(ab, bc, ac, count - 1);
    } else {
        triangle(a, b, c);
    }
}

function triangle(a, b, c) {
    positions.push(...a, ...b, ...c);
    // Assign a random color to each triangle
    const color = [Math.random(), Math.random(), Math.random(), 1.0];
    colors.push(...color, ...color, ...color);
}

// functions for vector operations
function mix(u, v, s) {
    return u.map((val, i) => (1 - s) * val + s * v[i]);
}

function normalize(v) {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return v.map(val => val / len);
}

function flatten(arr) {
    return new Float32Array(arr.flat());
}

function loadBuffers() {
    // position buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(positions), gl.STATIC_DRAW);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    // color
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const modelViewMatrix = mat4.create();
    const projectionMatrix = mat4.create();

    mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 100.0);
    mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -3]);
    mat4.rotateX(modelViewMatrix, modelViewMatrix, rotationX);
    mat4.rotateY(modelViewMatrix, modelViewMatrix, rotationY);

    gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);

    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 3);
    requestAnimationFrame(render);
}

// adding event listeners to support interaction
canvas.addEventListener('mousedown', (event) => {
    isDragging = true;
    previousMouseX = event.clientX;
    previousMouseY = event.clientY;
});

canvas.addEventListener('mousemove', (event) => {
    if (isDragging) {
        const deltaX = event.clientX - previousMouseX;
        const deltaY = event.clientY - previousMouseY;
        rotationY += deltaX * 0.01;
        rotationX += deltaY * 0.01;
        previousMouseX = event.clientX;
        previousMouseY = event.clientY;
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
});

canvas.addEventListener('mouseleave', () => {
    isDragging = false;
});

// initializing WebGL and starting the rendering
gl.clearColor(0.0, 0.0, 0.0, 1.0);
gl.enable(gl.DEPTH_TEST);
initSphere();





