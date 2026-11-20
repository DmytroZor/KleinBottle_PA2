'use strict';
// Run with: node tests/geometry.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const context = vm.createContext({ Math, console });
vm.runInContext(source, context);
const sample = expr => vm.runInContext(expr, context);
const EPS = 1e-7;
function near(a, b, epsilon = EPS) { return Math.abs(a - b) <= epsilon; }
function nearVec(a, b, epsilon = EPS) { return a.length === b.length && a.every((x, i) => near(x, b[i], epsilon)); }
const mesh = sample('CreateSurfaceData(64,48)');
assert.equal(mesh.positions.length / 3, 65 * 49);
assert.equal(mesh.normals.length, mesh.positions.length);
assert.equal(mesh.indices.length, 64 * 48 * 6);
assert.equal(mesh.lineIndices.length, (65 * 48 + 64 * 49 + 64 * 48) * 2);
assert(mesh.indices.every(i => i >= 0 && i < 65 * 49));
assert(mesh.normals.every(Number.isFinite));

const detail = sample('CreateSurfaceData(160,160)');
assert.equal(detail.positions.length / 3, 25921);
assert.equal(detail.indices.length / 3, 51200);
assert(detail.indices.reduce((m,x)=>Math.max(m,x),0) < 65536);

let maxNormalError = 0;
for (let k = 0; k < 300; k++) {
    const u = 2 * Math.PI * (k + 0.22) / 300;
    const v = 2 * Math.PI * ((79 * k % 300) + 0.31) / 300;
    const p = (u, v) => sample(`kleinBottlePoint(${u},${v})`);
    const n = sample(`kleinBottleNormal(${u},${v})`);
    const delta = 1e-5;
    const plusU = p(u + delta, v), minusU = p(u - delta, v);
    const plusV = p(u, v + delta), minusV = p(u, v - delta);
    const du = plusU.map((val,i) => (val - minusU[i]) / (2 * delta));
    const dv = plusV.map((val,i) => (val - minusV[i]) / (2 * delta));
    const expected = [
        du[1]*dv[2]-du[2]*dv[1],
        du[2]*dv[0]-du[0]*dv[2],
        du[0]*dv[1]-du[1]*dv[0]
    ];
    const norm = Math.hypot(...expected);
    const err = Math.hypot(...n.map((x,i) => x - expected[i] / norm));
    maxNormalError = Math.max(maxNormalError, err);
    assert(Math.abs(Math.hypot(...n) - 1) < EPS);
    assert(err < 1e-8, `analytic normal differs from numerical derivative: ${err}`);
}
for (const v of [0.1, 0.9, 2.3, 3.6, 5.6]) {
    const left = sample(`kleinBottlePoint(0, ${v})`);
    const right = sample(`kleinBottlePoint(2*Math.PI, ${2 * Math.PI - v})`);
    assert(nearVec(left, right), 'twisted Klein-bottle U seam is not continuous');
    const lNormal = sample(`kleinBottleNormal(0, ${v})`);
    const rNormal = sample(`kleinBottleNormal(2*Math.PI, ${2 * Math.PI - v})`);
    assert(nearVec(lNormal, rNormal.map(x=>-x)), 'normal must reverse at twisted U seam');
}
console.log('Geometry tests passed. Max analytic normal difference:', maxNormalError);
console.log('Default:', mesh.positions.length / 3, 'vertices,', mesh.indices.length / 3, 'triangles.');
console.log('Maximum:', detail.positions.length / 3, 'vertices,', detail.indices.length / 3, 'triangles.');
