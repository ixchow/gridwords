"use strict";

const MODELS = {
};

MODELS.load = function MODELS_load() {
	load_models('gridwords.pnct')
}

function load_models(name) {
	var xhr = new XMLHttpRequest();
	xhr.addEventListener('load', function(){
		console.log("Loaded models from '" + name + "'");
		window.MODEL = this.response;



		var doTangents = false;
		var doUVs = false;

		var count = MODEL.byteLength;
		if (name.endsWith(".v3n3c4")) {
			count = MODEL.byteLength / (3 * 4 + 3 * 4 + 4 * 1);
		} else if (name.endsWith(".v3n3t4u2c4")) {
			count = MODEL.byteLength / (3 * 4 + 3 * 4 + 4 * 4 + 2 * 4 + 4 * 1);
			doTangents = true;
			doUVs = true;
		} else {
			console.error("unknown model format: " + name);
		}
		if (Math.round(count) != count) {
			console.log("Model isn't evenly divisible by attribute size.");
			return;
		}
		attributes = {};

		var ofs = 0;

		attributes.aPosition = new Float32Array(MODEL, ofs, 3*count);
		attributes.aPosition.size = 3;
		ofs += 3*4*count;

		attributes.aNormal = new Float32Array(MODEL, ofs, 3*count);
		attributes.aNormal.size = 3;
		ofs += 3*4*count;

		if (doTangents) {
			attributes.aTangent = new Float32Array(MODEL, ofs, 4*count);
			attributes.aTangent.size = 4;
			ofs += 4*4*count;
		}

		if (doUVs) {
			attributes.aUV = new Float32Array(MODEL, ofs, 2*count);
			attributes.aUV.size = 2;
			ofs += 2*4*count;
		}

		attributes.aColor = new Uint8Array(MODEL, ofs, 4*count);
		attributes.aColor.size = 4;
		ofs += 4*count;

		uploadAttributes(program, attributes);
		requestRedraw();
	});
	xhr.addEventListener('error', function(){
		console.log("Error loading model.");
	});
	xhr.open("GET", "models/" + name);
	xhr.responseType = "arraybuffer";
	xhr.send();

};
