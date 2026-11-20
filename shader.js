'use strict';

// GOURAUD SHADING: ambient, diffuse and specular are all computed PER VERTEX.
// The GPU interpolates the resulting vertex colors over each triangle.
const vertexShaderSource = `
attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uModelView;
uniform mat4 uProjection;
uniform mat3 uNormalMatrix;
uniform vec3 uLightEye;  // Point light already transformed into eye coordinates.
uniform vec3 uBaseColor;

varying vec3 vLitColor;

void main() {
    vec3 pEye = (uModelView * vec4(aPosition, 1.0)).xyz;
    vec3 N = normalize(uNormalMatrix * aNormal);
    vec3 L = normalize(uLightEye - pEye);

    // A Klein bottle is non-orientable. Its mesh has two visible sides,
    // so illuminate whichever side is facing the point light.
    if (dot(N, L) < 0.0) {
        N = -N;
    }

    vec3 ambientLight = vec3(0.17, 0.19, 0.23);
    vec3 diffuseLight = vec3(0.90, 0.88, 0.93);
    vec3 specularLight = vec3(0.92, 0.95, 1.00);

    float diffuseFactor = max(dot(N, L), 0.0);

    // Global-viewer model permitted by the assignment: viewer points +Z in eye space.
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 R = reflect(-L, N);
    float specularFactor = pow(max(dot(R, V), 0.0), 28.0);

    vec3 ambient = uBaseColor * ambientLight;
    vec3 diffuse = uBaseColor * diffuseLight * diffuseFactor;
    vec3 specular = specularLight * specularFactor * 0.75;
    vLitColor = clamp(ambient + diffuse + specular, 0.0, 1.0);

    gl_Position = uProjection * vec4(pEye, 1.0);
}`;

// No per-pixel lighting here: it would be Phong shading, not Gouraud.
const fragmentShaderSource = `
precision mediump float;
varying vec3 vLitColor;
void main() {
    gl_FragColor = vec4(vLitColor, 1.0);
}`;

// Optional grid overlay, separate from the required Gouraud lighting shader.
const lineVertexShaderSource = `
attribute vec3 aPosition;
uniform mat4 uModelViewProjection;
void main() {
    gl_Position = uModelViewProjection * vec4(aPosition, 1.0);
}`;

const lineFragmentShaderSource = `
precision mediump float;
uniform vec4 uLineColor;
void main() {
    gl_FragColor = uLineColor;
}`;
