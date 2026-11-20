'use strict';

// ControlTask | THREE independent maps: diffuse, specular, normal.
// Diffuse and specular are modulated separately, while a tangent-space normal
// is sampled for each PIXEL and transformed using a normal-priority TBN frame.
const vertexShaderSource = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aTangent;
attribute vec2 aTexCoord;

uniform mat4 uModelView;
uniform mat4 uProjection;
uniform mat3 uNormalMatrix;

varying vec3 vPositionEye;
varying vec3 vNormalEye;
varying vec3 vTangentEye;
varying vec2 vTexCoord;

void main() {
    vec4 eyePos = uModelView * vec4(aPosition, 1.0);
    vPositionEye = eyePos.xyz;
    vNormalEye = normalize(uNormalMatrix * aNormal);
    // The existing PA2 camera uses only rotations and translations, so its
    // upper-left 3x3 transforms tangents; Gram-Schmidt is performed per pixel.
    vTangentEye = normalize(mat3(uModelView) * aTangent);
    vTexCoord = aTexCoord;
    gl_Position = uProjection * eyePos;
}`;

const fragmentShaderSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uDiffuseTexture;  // Texture unit 0
uniform sampler2D uSpecularTexture; // Texture unit 1
uniform sampler2D uNormalTexture;   // Texture unit 2
uniform vec3 uLightEye;           // Point light in eye coordinates
uniform bool uUseDiffuseMap;
uniform bool uUseSpecularMap;
uniform bool uUseNormalMap;

varying vec3 vPositionEye;
varying vec3 vNormalEye;
varying vec3 vTangentEye;
varying vec2 vTexCoord;

void main() {
    // VARIANT 6: GRAM-SCHMIDT WITH PRIORITY TO NORMAL.
    // Keep N unchanged (except normalization) and remove the tangent's
    // projection onto N. This is NOT the tangent-priority variant.
    vec3 N = normalize(vNormalEye);
    vec3 T = normalize(vTangentEye - dot(vTangentEye, N) * N);
    vec3 B = normalize(cross(N, T));
    mat3 TBN = mat3(T, B, N);

    vec3 sampledNormal = texture2D(uNormalTexture, vTexCoord).rgb * 2.0 - 1.0;
    vec3 texNormal = uUseNormalMap ? normalize(sampledNormal) : vec3(0.0, 0.0, 1.0);
    vec3 normalEye = normalize(TBN * texNormal);

    vec3 L = normalize(uLightEye - vPositionEye);
    // The Klein bottle is non-orientable: illuminate whichever side is lit.
    if (dot(normalEye, L) < 0.0) normalEye = -normalEye;

    // Each map modulates the lighting term explicitly requested.
    vec3 diffuseMap = uUseDiffuseMap ? texture2D(uDiffuseTexture, vTexCoord).rgb : vec3(0.19, 0.70, 0.87);
    vec3 specularMap = uUseSpecularMap ? texture2D(uSpecularTexture, vTexCoord).rgb : vec3(0.48);

    vec3 ambient = vec3(0.024, 0.052, 0.072);
    float diffuseFactor = max(dot(normalEye, L), 0.0);
    vec3 diffuse = diffuseMap * vec3(0.92, 0.98, 1.06) * diffuseFactor;

    vec3 V = normalize(-vPositionEye);
    vec3 H = normalize(L + V);
    float specularFactor = pow(max(dot(normalEye, H), 0.0), 45.0);
    vec3 specular = specularMap * vec3(1.35, 1.34, 1.33) * specularFactor;

    vec3 color = ambient + diffuse + specular;
    gl_FragColor = vec4(pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}`;

// Keep PA2 working as a comparison mode: Gouraud is still calculated in the
// vertex shader; per-pixel normal mapping requires the new fragment mode.
// GOURAUD SHADING: ambient, diffuse and specular are all computed PER VERTEX.
// The GPU interpolates the resulting vertex colors over each triangle.
const pa2VertexShaderSource = `
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
const pa2FragmentShaderSource = `
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
