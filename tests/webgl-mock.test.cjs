'use strict';
// Simulated WebGL 1 API: verifies JS wiring/buffers/texture units and UI state.
// This is NOT a real GPU shader compilation test; check in a normal browser too.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const calls = [];
const buffers = [];
const elements = new Map();
for (const id of ['webglcanvas','textureStatus','meshInfo','error','uSegments','vSegments','uSegmentsValue','vSegmentsValue','renderMode','modeDescription','useDiffuseMap','useSpecularMap','useNormalMap','showEdges','animateLight','textureAngle','textureAngleValue','uvPad','uvCursor','pivotU','pivotV','pivotReadout','enableRotation','showPivotMarker','resetPivot','captureScreenshot']) {
  elements.set(id, {value:id==='renderMode'?'normal-mapped':'',textContent:'',hidden:true,checked:true,
      classList:{add(){}},style:{}, listeners:{}, addEventListener(event,fn){this.listeners[event]=fn;}});
}
const gl = {
  VERTEX_SHADER:1, FRAGMENT_SHADER:2, COMPILE_STATUS:3, LINK_STATUS:4,
  TEXTURE_2D:5, TEXTURE0:20,TEXTURE1:21,TEXTURE2:22, RGBA:23, RGB:24, UNSIGNED_BYTE:25,
  LINEAR:26,LINEAR_MIPMAP_LINEAR:27,TEXTURE_MIN_FILTER:28,TEXTURE_MAG_FILTER:29,
  TEXTURE_WRAP_S:30,TEXTURE_WRAP_T:31,REPEAT:32,UNPACK_FLIP_Y_WEBGL:33,
  ARRAY_BUFFER:40,ELEMENT_ARRAY_BUFFER:41,STATIC_DRAW:42,TRIANGLES:43,LINES:44,
  FLOAT:45,UNSIGNED_SHORT:46,DEPTH_TEST:47,CULL_FACE:48,COLOR_BUFFER_BIT:49,DEPTH_BUFFER_BIT:50,
  POLYGON_OFFSET_FILL:51, BLEND:52,SRC_ALPHA:53,ONE_MINUS_SRC_ALPHA:54,
  canvas:{width:1000,height:745},POINTS:55,DYNAMIC_DRAW:56,
  createShader:t=>({t}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,
  getShaderInfoLog:()=>'',createProgram:()=>({}),attachShader(){},linkProgram(){},
  getProgramParameter:()=>true,getProgramInfoLog:()=>'',deleteShader(){},
  getAttribLocation:(_p,n)=>({aPosition:0,aNormal:1,aTangent:2,aTexCoord:3}[n]??0),
  getUniformLocation:(_p,n)=>n,
  createBuffer:()=>({}),bindBuffer:(...a)=>calls.push(['bindBuffer',...a]),
  bufferData:(target,a)=>{calls.push(['bufferData',target,a.length]);buffers.push([target,a]);},
  vertexAttribPointer(){},enableVertexAttribArray(){},
  drawElements:(...a)=>calls.push(['drawElements',...a]),
  drawArrays:(...a)=>calls.push(['drawArrays',...a]),
  createTexture:()=>({}),bindTexture:(...a)=>calls.push(['bindTexture',...a]),
  texImage2D:(...a)=>calls.push(['texImage2D',a.length]),
  texParameteri(){},pixelStorei(){},generateMipmap(){},
  activeTexture:(x)=>calls.push(['activeTexture',x]),
  uniform1i:(name,val)=>calls.push(['uniform1i',name,val]),
  uniform1f:(name,val)=>calls.push(['uniform1f',name,val]),
  uniform2fv:(name,val)=>calls.push(['uniform2fv',name,[...val]]),
  uniform3fv(){},uniform4fv(){},uniformMatrix4fv(){},uniformMatrix3fv(){},
  viewport(){},clearColor(){},clear(){},useProgram(){},enable(){},disable(){},polygonOffset(){},blendFunc(){}
};
elements.get('webglcanvas').getContext=()=>gl;
const listeners={};
const document={getElementById:(id)=>{assert(elements.has(id),`unrecognized DOM ${id}`);return elements.get(id);},addEventListener:(name,fn)=>{listeners[name]=fn;}};
elements.get('uvPad').getBoundingClientRect=()=>({left:0,top:0,width:200,height:200});
class ImageMock {
  constructor(){this.onload=null;this.onerror=null;}
  set src(v){calls.push(['imageSrc',v]); if(this.onload)this.onload();}
}
const context=vm.createContext({console,Math, document,Image:ImageMock,requestAnimationFrame:()=>{},
  TrackballRotator:class{constructor(){}getViewMatrix(){return vm.runInContext('m4.identity()',context);}}
});
for(const f of ['Utils/m4.js','shader.js','Model.js','main.js']){
  vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f});
}
vm.runInContext('init();draw()',context);
assert.equal(elements.get('textureStatus').textContent,'Textures loaded: 3 / 3');
assert(elements.get('meshInfo').textContent.includes('6,144 triangles'));
assert.equal(calls.filter(c=>c[0]==='imageSrc').length,3);
assert(calls.some(c=>c[0]==='activeTexture'&&c[1]===gl.TEXTURE0));
assert(calls.some(c=>c[0]==='activeTexture'&&c[1]===gl.TEXTURE1));
assert(calls.some(c=>c[0]==='activeTexture'&&c[1]===gl.TEXTURE2));
for(const [sampler,unit] of [['uDiffuseTexture',0],['uSpecularTexture',1],['uNormalTexture',2]]){
  assert(calls.some(c=>c[0]==='uniform1i'&&c[1]===sampler&&c[2]===unit));
}
assert(calls.some(c=>c[0]==='drawElements'&&c[1]===gl.TRIANGLES&&c[2]===6144*3));
const normalToggle=elements.get('useNormalMap');normalToggle.listeners.change({target:{checked:false}});
vm.runInContext('draw()',context);
assert(calls.some(c=>c[0]==='uniform1i'&&c[1]==='uUseNormalMap'&&c[2]===0));
const renderToggle=elements.get('renderMode');renderToggle.listeners.change({target:{value:'gouraud'}});
vm.runInContext('draw()',context);
assert(elements.get('modeDescription').textContent.includes('PA2 comparison'));
const slider=elements.get('uSegments');
slider.value='86';slider.listeners.input({target:{}});
assert(elements.get('meshInfo').textContent.includes('vertices'));
console.log('Simulated WebGL integration: texture units, 3 uploads, indexed draw, toggles + mesh rebuild passed.');

assert(calls.some(c=>c[0]==='uniform1f'&&c[1]==='uTextureAngle'));
assert(calls.some(c=>c[0]==='uniform2fv'&&c[1]==='uTexturePivot'));
assert(calls.some(c=>c[0]==='drawArrays'&&c[1]===gl.POINTS));
renderToggle.listeners.change({target:{value:'normal-mapped'}});
const angleCtl=elements.get('textureAngle');
angleCtl.value='90';angleCtl.listeners.input({target:{}});
vm.runInContext('draw()',context);
assert(calls.some(c=>c[0]==='uniform1f'&&c[1]==='uTextureAngle'&&Math.abs(c[2]-Math.PI/2)<1e-8));
listeners.keydown({key:'d',target:{tagName:'BODY'},preventDefault(){}});
vm.runInContext('draw()',context);
assert(calls.some(c=>c[0]==='uniform2fv'&&c[1]==='uTexturePivot'&&c[2][0]>.42));
// Clicking the UV pad selects the pivot in normalized U,V coordinates.
elements.get('uvPad').listeners.pointerdown({clientX:50,clientY:150});
vm.runInContext('draw()',context);
assert(calls.some(c=>c[0]==='uniform2fv'&&c[1]==='uTexturePivot'&&Math.abs(c[2][0]-.25)<1e-8 && Math.abs(c[2][1]-.25)<1e-8));
console.log('CGW simulated WebGL: rotation uniforms, point marker, WASD, UV-pad click and degree slider passed.');
