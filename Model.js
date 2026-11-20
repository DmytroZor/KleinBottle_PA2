'use strict';

/** GPU representation of the indexed Klein-bottle mesh, with UV and tangents. */
function Model(name) {
    this.name = name;
    this.positionBuffer = gl.createBuffer();
    this.normalBuffer = gl.createBuffer();
    this.tangentBuffer = gl.createBuffer();
    this.texCoordBuffer = gl.createBuffer();
    this.triangleIndexBuffer = gl.createBuffer();
    this.lineIndexBuffer = gl.createBuffer();
    this.triangleIndexCount = 0;
    this.lineIndexCount = 0;
    this.vertexCount = 0;

    this.BufferData = function (mesh) {
        this.vertexCount = mesh.positions.length / 3;
        this.triangleIndexCount = mesh.indices.length;
        this.lineIndexCount = mesh.lineIndices.length;

        for (const [buffer, data] of [
            [this.positionBuffer, mesh.positions],
            [this.normalBuffer, mesh.normals],
            [this.tangentBuffer, mesh.tangents],
            [this.texCoordBuffer, mesh.texCoords]
        ]) {
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.triangleIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.lineIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.lineIndices), gl.STATIC_DRAW);
    };

    this.bindAttribute = function (location, buffer, components) {
        if (location < 0 || location === undefined) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(location, components, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(location);
    };

    this.Draw = function (program) {
        this.bindAttribute(program.aPosition, this.positionBuffer, 3);
        this.bindAttribute(program.aNormal, this.normalBuffer, 3);
        // These two are inactive (-1) in the legacy PA2 Gouraud program.
        this.bindAttribute(program.aTangent, this.tangentBuffer, 3);
        this.bindAttribute(program.aTexCoord, this.texCoordBuffer, 2);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.triangleIndexBuffer);
        gl.drawElements(gl.TRIANGLES, this.triangleIndexCount, gl.UNSIGNED_SHORT, 0);
    };

    this.DrawLines = function (program) {
        this.bindAttribute(program.aPosition, this.positionBuffer, 3);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.lineIndexBuffer);
        gl.drawElements(gl.LINES, this.lineIndexCount, gl.UNSIGNED_SHORT, 0);
    };
}
