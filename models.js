"use strict";

const MODELS = {
};

MODELS.load = function MODELS_load(callback) {
	load_models('gridwords.pnct', callback);
}

function load_models(name, callback) {
	var xhr = new XMLHttpRequest();
	xhr.addEventListener('load', function(){
		console.log("Loaded models from '" + name + "'");
		const response = this.response;

		const d = new DataView(this.response);
		let pos = 0;
		function getChunk(magic) {
			const headerMagic = 
				String.fromCodePoint(d.getUint8(pos+0))
				+ String.fromCodePoint(d.getUint8(pos+1))
				+ String.fromCodePoint(d.getUint8(pos+2))
				+ String.fromCodePoint(d.getUint8(pos+3));
			pos += 4;
			if (headerMagic != magic) {
				throw new Error("Expected '" + magic + "' got '" + headerMagic + "'");
			}
			const headerSize = d.getUint32(pos, true);
			pos += 4;
			const ret = new DataView(response, pos, headerSize);
			pos += headerSize;
			return ret;
		}

		let data = getChunk('pnct');
		let strings = getChunk('str0');
		let index = getChunk('idx0');
		//----- parse index -----

		for (let pos = 0; pos < index.byteLength; pos += 16) {
			const nameBegin = index.getUint32(pos, true);
			const nameEnd = index.getUint32(pos+4, true);
			const vertexBegin = index.getUint32(pos+8, true);
			const vertexEnd = index.getUint32(pos+12, true);
			const model = {
				name:"",
				type:gl.TRIANGLES,
				start:vertexBegin,
				count:vertexEnd-vertexBegin
			};
			for (let n = nameBegin; n < nameEnd; ++n) {
				model.name += String.fromCodePoint(strings.getUint8(n));
			}
			MODELS[model.name] = model;
		}

		//----- upload data to GPU -----
		let buffer = gl.createBuffer();

		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

		const stride = 3*4+3*4+4*1+2*4;

		//0 => Position
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
		//1 => Normal
		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3*4);
		//2 => Color
		gl.enableVertexAttribArray(2);
		gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, stride, 3*4+3*4);
		//3 => TexCoord
		gl.enableVertexAttribArray(3);
		gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 3*4+3*4+4*1);

		callback();
	});
	xhr.addEventListener('error', function(){
		console.log("Error loading model.");
	});
	xhr.open("GET", "models/" + name);
	xhr.responseType = "arraybuffer";
	xhr.send();

};
