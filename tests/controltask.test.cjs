'use strict';
// Standalone test: no WebGL/Node modules besides the built-in standard library.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const shader = fs.readFileSync(path.join(root, 'shader.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const model = fs.readFileSync(path.join(root, 'Model.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

for (const name of ['uDiffuseTexture','uSpecularTexture','uNormalTexture']) {
    assert(shader.includes(`uniform sampler2D ${name}`), `${name}: sampler missing`);
    assert(main.includes(`gl.getUniformLocation(lit, '${name}')`), `${name}: uniform not linked`);
}
assert(shader.includes('texture2D(uNormalTexture, vTexCoord).rgb * 2.0 - 1.0'));
assert(shader.includes('vec3 N = normalize(vNormalEye);'));
assert(shader.includes('normalize(vTangentEye - dot(vTangentEye, N) * N)'));
assert(shader.includes('vec3 B = normalize(cross(N, T))'));
assert(shader.includes('mat3 TBN = mat3(T, B, N)'));
assert(shader.includes('normalEye = normalize(TBN * texNormal)'));
assert(shader.includes('diffuse = diffuseMap *'));
assert(shader.includes('specular = specularMap *'));
assert(!shader.includes('vec3 N = normalize(vTangentEye);'), 'wrong priority');
assert(shader.includes('const pa2VertexShaderSource'));
assert(shader.includes('const pa2FragmentShaderSource'));

assert(main.includes('tangents.push(...kleinBottleTangent(u, v))'));
assert(main.includes('texCoords.push(i / nU, j / nV)'));
assert(main.includes('gl.activeTexture(gl.TEXTURE0)'));
assert(main.includes('gl.activeTexture(gl.TEXTURE1)'));
assert(main.includes('gl.activeTexture(gl.TEXTURE2)'));
assert(model.includes('gl.drawElements(gl.TRIANGLES'));
for (const name of ['useDiffuseMap','useSpecularMap','useNormalMap','uSegments','vSegments','renderMode']) {
    assert(html.includes(`id="${name}"`), `${name}: UI missing`);
}

for (const name of ['diffuse','specular','normal']) {
    const filename = path.join(root, 'textures', `${name}.png`);
    const bytes = fs.readFileSync(filename);
    assert.equal(bytes.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16),512);
    assert.equal(bytes.readUInt32BE(20),512);
    console.log(`${name} texture: 512x512, ${(bytes.length/1024).toFixed(1)} KiB`);
}
console.log('3-texture + normal-priority shader checks passed.');
