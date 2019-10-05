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

let loading = true;

SHADERS.load();
MODELS.load(function(){
	loading = false;
	queueUpdate();
});

//onresize resizes the canvas's contents based on its external size:
function resized() {
	const size = {x:CANVAS.clientWidth, y:CANVAS.clientHeight};
	CANVAS.width = size.x;
	CANVAS.height = size.y;
	queueUpdate();
}

window.addEventListener('resize', resized);
resized();

function queueUpdate() {
	if (queueUpdate.queued) return;
	queueUpdate.queued = true;
	window.requestAnimationFrame(function(timestamp){
		delete queueUpdate.queued;
		if (!('prevTimestamp' in queueUpdate)) {
			queueUpdate.prevTimestamp = timestamp;
		}
		const delta = timestamp = queueUpdate.prevTimestamp;
		update(delta / 1000.0);
		queueUpdate.prevTimestamp = timestamp;
	});
}

//-----------------------------

const BOARD = {
	grid:[
		"             ",
		"     ...     ",
		" ........... ",
		" ..nothing.. ",
		" .....   ... ",
		"    .......  ",
		"     ...     ",
		"             "
	]
};

const CAMERA = {
	fovy:30.0,
	aspect:1.0,
	near:10.0,
	target:{x:0.0, y:0.0, z:0.0},
	radius:30.0,
	azimuth:0.02 * Math.PI,
	elevation:0.45 * Math.PI,
	makeFrame:function() {
		var ca = Math.cos(this.azimuth); var sa = Math.sin(this.azimuth);
		var ce = Math.cos(this.elevation); var se = Math.sin(this.elevation);
		var right = {x:ca, y:sa, z:0.0};
		var forward = {x:ce*-sa, y:ce*ca, z:-se};
		var up = {x:se*-sa, y:se*ca, z:ce};
		return {
			right:right,
			forward:forward,
			up:up,
			at:{
				x:this.target.x - this.radius*forward.x,
				y:this.target.y - this.radius*forward.y,
				z:this.target.z - this.radius*forward.z
			},
		};
	}
};

const MOUSE = {
	at:{x:NaN, y:NaN},
	grid:{x:NaN, y:NaN}
};

function setMouse(evt) {
	const rect = CANVAS.getBoundingClientRect();
	MOUSE.at = {
		x:(evt.clientX - rect.left) / rect.width * 2.0 - 1.0,
		y:(evt.clientY - rect.bottom) / -rect.height * 2.0 - 1.0
	};

	//solve posn on plane -- raycast from camera:
	const frame = CAMERA.makeFrame();
	const fy = Math.tan(0.5 * CAMERA.fovy / 180.0 * Math.PI);
	const fx = fy * CAMERA.aspect;

	const origin = frame.at;
	const direction = {
		x:frame.right.x * fx * MOUSE.at.x + frame.up.x * fy * MOUSE.at.y + frame.forward.x,
		y:frame.right.y * fx * MOUSE.at.x + frame.up.y * fy * MOUSE.at.y + frame.forward.y,
		z:frame.right.z * fx * MOUSE.at.x + frame.up.z * fy * MOUSE.at.y + frame.forward.z,
	};

	if (direction.z > -0.001) {
		MOUSE.grid = {x:NaN, y:NaN};
		queueUpdate();
	} else {
		const t = -origin.z / direction.z;
		MOUSE.grid = {
			x:Math.round(0.5 * (t * direction.x + origin.x)),
			y:Math.round(0.5 * (t * direction.y + origin.y))
		};
		queueUpdate();
	}
}

window.addEventListener('mousemove', function(evt){
	evt.preventDefault();
	setMouse(evt);
	return false;
});
window.addEventListener('mousedown', function(evt){
	evt.preventDefault();
	setMouse(evt);
	handleDown(evt);
	return false;
});

window.addEventListener('mouseup', function(evt){
	evt.preventDefault();
	setMouse(evt);
	handleUp();
	return false;
});


function update(elapsed) {

	{ //update camera to see whole board:
		const size = {
			x:parseInt(CANVAS.width),
			y:parseInt(CANVAS.height)
		};
		CAMERA.aspect = size.x / size.y;
		CAMERA.radius = 1000.0;

		const frame = CAMERA.makeFrame();

		let important = [];
		for (let y = 1; y < BOARD.grid.length; ++y) {
			for (let x = 1; x < BOARD.grid[y].length; ++x) {
				let c00 = (BOARD.grid[y-1][x-1] !== ' ');
				let c10 = (BOARD.grid[y][x-1] !== ' ');
				let c01 = (BOARD.grid[y][x-1] !== ' ');
				let c11 = (BOARD.grid[y][x] !== ' ');

				if (c00 === c10 && c00 === c01 && c00 == c11) continue;

				important.push({x:2*x, y:2*y, z:0.0});
			}
		}

		let min = {x:0.0, y:0.0};
		let max = {x:0.0, y:0.0};

		important.forEach(function(pt){
			min.x = Math.min(min.x, pt.x);
			min.y = Math.min(min.y, pt.y);
			max.x = Math.max(max.x, pt.x);
			max.y = Math.max(max.y, pt.y);
		});

		CAMERA.target.x = 0.5 * (min.x + max.x);
		CAMERA.target.y = 0.5 * (min.y + max.y);
		CAMERA.target.z = 0.0;

		let fy = Math.tan(0.5 * CAMERA.fovy / 180.0 * Math.PI);
		let fx = fy * CAMERA.aspect;

		let r = 1.0;

		important.forEach(function(pt){
			let x = dot(pt, frame.right) - dot(CAMERA.target, frame.right);
			let y = dot(pt, frame.up) - dot(CAMERA.target, frame.up);
			let z = dot(pt, frame.forward) - dot(CAMERA.target, frame.forward);

			//want -fx < x / (z + r) < fx:
			r = Math.max(r, Math.abs(x) / fx - z);
			r = Math.max(r, Math.abs(y) / fy - z);
		});

		CAMERA.radius = r;
	}

	draw();

	//queueUpdate();
}

function draw() {
	const size = {
		x:parseInt(CANVAS.width),
		y:parseInt(CANVAS.height)
	};
	gl.viewport(0,0,size.x,size.y);

	if (loading) {
		gl.clearColor(1.0,0.0,1.0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		//TODO: fancy loading bar or something.
		return;
	}

	//update camera:
	CAMERA.aspect = size.x / size.y;


	gl.clearColor(0.2,0.2,0.2, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	gl.enable(gl.DEPTH_TEST);
	gl.depthFunc(gl.LESS);
	gl.disable(gl.BLEND);

	//build uniforms:
	const u = {};

	var frame = CAMERA.makeFrame();
	var eye = frame.at;

	u.uEye = new Float32Array([eye.x, eye.y, eye.z]);

	const worldToCamera = new Float32Array([
		frame.right.x, frame.up.x,-frame.forward.x, 0.0,
		frame.right.y, frame.up.y,-frame.forward.y, 0.0,
		frame.right.z, frame.up.z,-frame.forward.z, 0.0,
		-dot(frame.right,frame.at), -dot(frame.up,frame.at), dot(frame.forward,frame.at), 1.0
	]);

	const cameraToClip = perspective(CAMERA.fovy, CAMERA.aspect, CAMERA.near);

	const worldToClip = mul(cameraToClip, worldToCamera);

	CAMERA.lastWorldToClip = worldToClip;

	const prog = SHADERS.solid;
	gl.useProgram(prog);

	function drawModel(model, at) {
		const objectToWorld = new Float32Array([
			1.0, 0.0, 0.0, 0.0,
			0.0, 1.0, 0.0, 0.0,
			0.0, 0.0, 1.0, 0.0,
			at.x, at.y, at.z, 1.0
		]);

		u.uObjectToClip = mul(worldToClip, objectToWorld);
		u.uObjectToLight = objectToWorld;

		const normalToWorld = new Float32Array([
			objectToWorld[0], objectToWorld[1], objectToWorld[2],
			objectToWorld[4], objectToWorld[5], objectToWorld[6],
			objectToWorld[8], objectToWorld[9], objectToWorld[10]
		]);
		u.uNormalToLight = normalToWorld;

		setUniforms(prog, u);
		gl.drawArrays(model.type, model.start, model.count);
	}

	for (let y = 0; y < BOARD.grid.length; ++y) {
		for (let x = 0; x < BOARD.grid[y].length; ++x) {
			let c = BOARD.grid[y][x];
			if (c === ' ') continue;
			const boost = (x == MOUSE.grid.x && y == MOUSE.grid.y);
			drawModel(MODELS["Grid.Square"], {x:2.0*x, y:2.0*y, z:0.0});
			if (c !== '.') {
				drawModel(MODELS["Tile." + c.toUpperCase()], {x:2.0*x, y:2.0*y, z:(boost ? 0.5 : 0.0)});
			}
		}
	}
}
