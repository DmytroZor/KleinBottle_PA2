'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'..');
const main = fs.readFileSync(path.join(root,'main.js'),'utf8');
const shader = fs.readFileSync(path.join(root,'shader.js'),'utf8');
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const sandbox=vm.createContext({Math,console});
vm.runInContext(main,sandbox);
const evalJS=expr => vm.runInContext(expr,sandbox);
const near = (a,b,tol=1e-9) => Math.abs(a-b) < tol;
function assertNearVec(actual, expected,eps=1e-9){assert(actual.every((x,i)=>near(x,expected[i],eps)), `${actual} != ${expected}`);}
for(const v of [[0,0],[.3,.7],[.42,.58],[1,1]]){
 assertNearVec(evalJS(`rotateTextureUV(${JSON.stringify(v)},${JSON.stringify(v)},31)`),v);
 assertNearVec(evalJS(`rotateTextureUV(${JSON.stringify(v)},${JSON.stringify(v)},-170)`),v);
}
assertNearVec(evalJS('rotateTextureUV([.75,.50],[.5,.5],90)'),[.5,.75]);
assertNearVec(evalJS('rotateTextureUV([.5,.75],[.5,.5],-90)'),[.75,.5]);
assertNearVec(evalJS('rotateTextureUV([.31,.62],[.25,.85],0)'),[.31,.62]);
// Inverse rotations must recover the original texcoord.
for(const a of [-180,-72,-10,0,35,90,180]){
 const uv=[.36,.18],pivot=[.42,.58];
 const first=evalJS(`rotateTextureUV(${JSON.stringify(uv)},${JSON.stringify(pivot)},${a})`);
 const second=evalJS(`rotateTextureUV(${JSON.stringify(first)},${JSON.stringify(pivot)},${-a})`);
 assertNearVec(second,uv);
}
for(const needle of ['uniform vec2 uTexturePivot','uniform float uTextureAngle','uniform bool uEnableRotation','centeredUV = vTexCoord - uTexturePivot','cs * centeredUV.x - sn * centeredUV.y','sn * centeredUV.x + cs * centeredUV.y', 'texture2D(uDiffuseTexture, rotatedUV)','texture2D(uSpecularTexture, rotatedUV)','texture2D(uNormalTexture, rotatedUV)']){
 assert(shader.includes(needle),`Shader missing ${needle}`);
}
for(const id of ['textureAngle','textureAngleValue','uvPad','uvCursor','pivotU','pivotV','pivotReadout','enableRotation','showPivotMarker','resetPivot','captureScreenshot']){
 assert(html.includes(`id="${id}"`),`${id}: missing from HTML`);
}
for(const uniform of ['uTexturePivot','uTextureAngle','uEnableRotation']){
 assert(main.includes(`gl.getUniformLocation(lit, '${uniform}')`),`uniform ${uniform} not located`);
}
assert(main.includes('document.addEventListener(\'keydown\', onPivotKeydown)'));
assert(main.includes('while (u > 1) { u -= 1; v = 1 - v; }'));
assert(main.includes('while (u < 0) { u += 1; v = 1 - v; }'));
assert(shader.includes('vec3 N = normalize(vNormalEye);')); // inherited normal priority
console.log('CGW: pivot invariance, 90° rotation, inverse rotation, GLSL uniforms, 3-map UV and controls passed.');
