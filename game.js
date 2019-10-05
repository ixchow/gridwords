"use string";
//Based, in part, on the MDN webGL tutorials:
// https://threejs.org/build/three.min.js
//and also based on the 15-466-f18 notes:
// http://graphics.cs.cmu.edu/courses/15-466-f18/notes/gl-helpers.js
// http://graphics.cs.cmu.edu/courses/15-466-f18/notes/brdf-toy.html
//and some helpers from on-forgetting:
// https://github.com/ixchow/on-forgetting

const CANVAS = document.getElementById("game");
const gl = CANVAS.getContext("webgl");
if (gl === null) {
	alert("Unable to init webgl");
	throw new Error("Init failed.");
}

SHADERS.load();
MODELS.load();

//onresize resizes the canvas's contents based on its external size:
function resized() {
	const size = {x:CANVAS.clientWidth, y:CANVAS.clientHeight};
	CANVAS.width = size.x;
	CANVAS.height = size.y;
	queueDraw();
}

window.addEventListener('resize', resized);
resized();

function queueDraw() {
	if (queueDraw.queued) return;
	queueDraw.queued = true;
	window.requestAnimationFrame(function(){
		delete queueDraw.queued;
		draw();
	});
}

function draw() {
	const size = {
		x:parseInt(CANVAS.width),
		y:parseInt(CANVAS.height)
	};
	gl.viewport(0,0,size.x,size.y);

	gl.clearColor(1.0,0.0,1.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT);
}
