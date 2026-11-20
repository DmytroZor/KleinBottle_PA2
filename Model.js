'use strict';

/** GPU representation of an indexed Klein-bottle triangle mesh. */
function Model(name) {
    this.name = name;
    this.positionBuffer = gl.createBuffer();
    this.normalBuffer = gl.createBuffer();
    this.triangleIndexBuffer = gl.createBuffer();
    this.lineIndexBuffer = gl.createBuffer();
    this.triangleIndexCount = 0;
    this.lineIndexCount = 0;
    this.vertexCount = 0;

    /** Upload positions and analytic normals as separate vertex attributes. */
    this.BufferData = function (mesh) {
        this.vertexCount = mesh.positions.length / 3;
        this.triangleIndexCount = mesh.indices.length;
        this.lineIndexCount = mesh.lineIndices.length;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.positions), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.normals), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.triangleIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.lineIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.lineIndices), gl.STATIC_DRAW);
    };

    this.bindPositions = function (location) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(location);
    };

    this.Draw = function (program) {
        this.bindPositions(program.aPosition);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(program.aNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.aNormal);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.triangleIndexBuffer);
        gl.drawElements(gl.TRIANGLES, this.triangleIndexCount, gl.UNSIGNED_SHORT, 0);
    };

    this.DrawLines = function (program) {
        this.bindPositions(program.aPosition);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.lineIndexBuffer);
        gl.drawElements(gl.LINES, this.lineIndexCount, gl.UNSIGNED_SHORT, 0);
    };
}
