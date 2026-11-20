'use strict';

let gl;
let surface;
let shProgram;
let lineProgram;
let spaceball;
let uSegments = 64;
let vSegments = 48;
let showEdges = false;
let animateLight = true;
let lightAngle = 0;
let previousFrameTime = null;

// Same Klein bottle parametrization used by PA1 and the supplied encyclopedia:
// Krivoshapko & Ivanov, Encyclopedia of Analytical Surfaces, p. 423 (PDF p. 442).
const KLEIN_A = 2.5; // The reference specifies a > 2.
const TWO_PI = 2 * Math.PI;

/** r(u,v) = (R cos u, R sin u, Z). */
function kleinBottlePoint(u, v) {
    const C = Math.cos(u / 2);
    const S = Math.sin(u / 2);
    const R = KLEIN_A + C * Math.sin(v) - S * Math.sin(2 * v);
    const Z = S * Math.sin(v) + C * Math.sin(2 * v);
    return [R * Math.cos(u), R * Math.sin(u), Z];
}

function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

/**
 * ANALYTIC VERTEX NORMAL (the specified variant):
 * n(u,v) = normalize( (dr/du) x (dr/dv) ).
 * Derivatives below are exact derivatives of the PA1 parametrization.
 * At the non-orientable u-seam the normal direction necessarily reverses.
 */
function kleinBottleNormal(u, v) {
    const C = Math.cos(u / 2);
    const S = Math.sin(u / 2);
    const cu = Math.cos(u);
    const su = Math.sin(u);
    const sv = Math.sin(v);
    const cv = Math.cos(v);
    const s2v = Math.sin(2 * v);
    const c2v = Math.cos(2 * v);

    const R = KLEIN_A + C * sv - S * s2v;
    const Ru = -0.5 * S * sv - 0.5 * C * s2v;
    const Rv = C * cv - 2 * S * c2v;
    const Zu = 0.5 * C * sv - 0.5 * S * s2v;
    const Zv = S * cv + 2 * C * c2v;

    const du = [Ru * cu - R * su, Ru * su + R * cu, Zu];
    const dv = [Rv * cu, Rv * su, Zv];

    const n = cross(du, dv);
    const length = Math.hypot(n[0], n[1], n[2]);
    if (length < 1e-10) {
        throw new Error('Degenerate normal at u=' + u + ', v=' + v);
    }
    return [n[0] / length, n[1] / length, n[2] / length];
}

/**
 * Build the complete indexed triangle mesh, retaining duplicated seam vertices.
 * For the Klein bottle r(2pi,v) = r(0,2pi-v): the u-seam is twist-identified.
 * The overlapping seam positions render closed without welding vertex normals,
 * which is essential because this surface is non-orientable.
 *
 * At the maximum resolution (160x160), (161^2)=25921 vertices fit in Uint16.
 */
function CreateSurfaceData(nU = uSegments, nV = vSegments) {
    if (!Number.isInteger(nU) || !Number.isInteger(nV) ||
        nU < 4 || nV < 4 || (nU + 1) * (nV + 1) > 65535) {
        throw new Error('Invalid U/V subdivision count for WebGL1 Uint16 indices.');
    }

    const positions = [];
    const normals = [];
    const indices = [];
    const lineIndices = [];
    const width = nV + 1;
    const id = (i, j) => i * width + j;

    for (let i = 0; i <= nU; i++) {
        const u = TWO_PI * i / nU;
        for (let j = 0; j <= nV; j++) {
            const v = TWO_PI * j / nV;
            positions.push(...kleinBottlePoint(u, v));
            normals.push(...kleinBottleNormal(u, v));
        }
    }

    for (let i = 0; i < nU; i++) {
        for (let j = 0; j < nV; j++) {
            const a = id(i, j);
            const b = id(i + 1, j);
            const c = id(i, j + 1);
            const d = id(i + 1, j + 1);

            // Two filled triangles per U-V cell, using shared vertex indices.
            indices.push(a, b, c, b, d, c);
        }
    }

    // Grid overlay has each U and V edge exactly once.
    for (let i = 0; i <= nU; i++) {
        for (let j = 0; j < nV; j++) {
            lineIndices.push(id(i, j), id(i, j + 1));
        }
    }
    for (let i = 0; i < nU; i++) {
        for (let j = 0; j <= nV; j++) {
            lineIndices.push(id(i, j), id(i + 1, j));
        }
    }

    // Show the diagonal of each quad as well: this is a TRIANGLE mesh overlay.
    for (let i = 0; i < nU; i++) {
        for (let j = 0; j < nV; j++) {
            lineIndices.push(id(i + 1, j), id(i, j + 1));
        }
    }

    return { positions, normals, indices, lineIndices };
}

/** Assemble the normal matrix transpose(inverse(ModelView)) as mat3. */
function getNormalMatrix(modelView) {
    const normal4 = m4.transpose(m4.inverse(modelView));
    return new Float32Array([
        normal4[0], normal4[1], normal4[2],
        normal4[4], normal4[5], normal4[6],
        normal4[8], normal4[9], normal4[10]
    ]);
}

function draw() {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.025, 0.035, 0.065, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = gl.canvas.width / gl.canvas.height;
    const projection = m4.perspective(Math.PI / 4, aspect, 1, 40);
    const trackballView = spaceball.getViewMatrix();
    // Preserve the rotation and camera translation from PA1.
    const initialRotation = m4.axisRotation([0.707, 0.707, 0], 0.7);
    const cameraTranslation = m4.translation(0, 0, -10);
    const modelView = m4.multiply(
        cameraTranslation,
        m4.multiply(initialRotation, trackballView)
    );
    const mvp = m4.multiply(projection, modelView);

    // Light follows a circular path in the surface's XY world plane.
    const lightWorld = [5.5 * Math.cos(lightAngle), 5.5 * Math.sin(lightAngle), 3.0];
    // Assignment requirement: convert light coordinates using ModelView BEFORE
    // sending the resulting eye-space coordinates to the GPU.
    const lightEye = m4.transformPoint(modelView, lightWorld);

    gl.useProgram(shProgram.prog);
    gl.uniformMatrix4fv(shProgram.uModelView, false, modelView);
    gl.uniformMatrix4fv(shProgram.uProjection, false, projection);
    gl.uniformMatrix3fv(shProgram.uNormalMatrix, false, getNormalMatrix(modelView));
    gl.uniform3fv(shProgram.uLightEye, lightEye);
    gl.uniform3fv(shProgram.uBaseColor, [0.16, 0.70, 0.92]);

    // Offset filled polygons slightly, so an optional grid can be drawn on top.
    if (showEdges) {
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(1.0, 1.0);
    }
    surface.Draw(shProgram);
    gl.disable(gl.POLYGON_OFFSET_FILL);

    if (showEdges) {
        gl.useProgram(lineProgram.prog);
        gl.uniformMatrix4fv(lineProgram.uMVP, false, mvp);
        gl.uniform4fv(lineProgram.uColor, [0.045, 0.11, 0.18, 0.55]);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        surface.DrawLines(lineProgram);
        gl.disable(gl.BLEND);
    }
}

function createProgram(vertexSource, fragmentSource) {
    function compile(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader));
        }
        return shader;
    }
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
    }
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return program;
}

function buildMesh() {
    const mesh = CreateSurfaceData(uSegments, vSegments);
    surface.BufferData(mesh);
    document.getElementById('meshInfo').textContent =
        (mesh.positions.length / 3).toLocaleString() + ' vertices · ' +
        (mesh.indices.length / 3).toLocaleString() + ' triangles';
}

function initGL() {
    const lit = createProgram(vertexShaderSource, fragmentShaderSource);
    shProgram = {
        prog: lit,
        aPosition: gl.getAttribLocation(lit, 'aPosition'),
        aNormal: gl.getAttribLocation(lit, 'aNormal'),
        uModelView: gl.getUniformLocation(lit, 'uModelView'),
        uProjection: gl.getUniformLocation(lit, 'uProjection'),
        uNormalMatrix: gl.getUniformLocation(lit, 'uNormalMatrix'),
        uLightEye: gl.getUniformLocation(lit, 'uLightEye'),
        uBaseColor: gl.getUniformLocation(lit, 'uBaseColor')
    };

    const lines = createProgram(lineVertexShaderSource, lineFragmentShaderSource);
    lineProgram = {
        prog: lines,
        aPosition: gl.getAttribLocation(lines, 'aPosition'),
        uMVP: gl.getUniformLocation(lines, 'uModelViewProjection'),
        uColor: gl.getUniformLocation(lines, 'uLineColor')
    };

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE); // Both sides of the Klein bottle must be visible.
    surface = new Model('KleinBottle');
    buildMesh();
}

function frame(timestamp) {
    if (previousFrameTime !== null && animateLight) {
        const dt = Math.min((timestamp - previousFrameTime) / 1000, 0.05);
        lightAngle = (lightAngle + dt * 0.65) % TWO_PI;
    }
    previousFrameTime = timestamp;
    draw();
    requestAnimationFrame(frame);
}

function init() {
    const canvas = document.getElementById('webglcanvas');
    const errorBox = document.getElementById('error');
    try {
        gl = canvas.getContext('webgl', { antialias: true });
        if (!gl) {
            throw new Error('WebGL is unavailable. Enable hardware acceleration.');
        }
        initGL();
        spaceball = new TrackballRotator(canvas, draw, 0);

        for (const [axis, id] of [['U', 'uSegments'], ['V', 'vSegments']]) {
            const input = document.getElementById(id);
            const output = document.getElementById(id + 'Value');
            input.addEventListener('input', () => {
                const value = Number(input.value);
                if (axis === 'U') uSegments = value;
                else vSegments = value;
                output.textContent = String(value);
                buildMesh();
            });
        }

        document.getElementById('showEdges').addEventListener('change', e => {
            showEdges = e.target.checked;
        });
        document.getElementById('animateLight').addEventListener('change', e => {
            animateLight = e.target.checked;
        });

        requestAnimationFrame(frame);
    } catch (error) {
        errorBox.textContent = 'Unable to render surface: ' + error.message;
        errorBox.hidden = false;
        console.error(error);
    }
}
