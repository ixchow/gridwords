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

let loading = 0;

SHADERS.load();

function addLoad(fn) {
	loading += 1;
	fn(function(){
		loading -= 1;
		queueUpdate();
	});
}

addLoad(MODELS.load);
addLoad(WORDS.load);

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
	],
	width:0,
	height:0,
	important:[],
	get:function BOARD_get(x,y) {
		if (x < 0 || x >= this.width) return null;
		if (y < 0 || y >= this.height) return null;
		return this.grid[y][x];
	}
};

function loadBoard(arr) {
	BOARD.height = arr.length;
	BOARD.width = arr[0].length;
	for (let y = 0; y < arr.length; ++y) {
		BOARD.width = Math.max(BOARD.width, arr[y].length);
	}

	BOARD.grid = new Array(BOARD.height);
	for (let y = 0; y < arr.length; ++y) {
		const row = new Array(BOARD.width);
		for (let x = 0; x < BOARD.width; ++x) {
			row[x] = null;
		}
		for (let x = 0; x < arr[y].length; ++x) {
			if (arr[y][x] === ' ') {
				continue;
			}
			row[x] = {
				pts:[
					{x:2*x-1, y:2*y-1},
					{x:2*x+1, y:2*y-1},
					{x:2*x+1, y:2*y+1},
					{x:2*x-1, y:2*y+1}
				]
			};
			if (arr[y][x] === '.') {
				//nothing to do.
			} else if (/^[a-z]$/.test(arr[y][x])) {
				row[x].letter = arr[y][x];
				row[x].locked = false;
			} else if (/^[A-Z]$/.test(arr[y][x])) {
				row[x].letter = arr[y][x].toLowerCase();
				row[x].locked = true;
			} else {
				console.warn("Ignoring '" + arr[y][x] + "'");
			}
		}
		BOARD.grid[BOARD.height-1-y] = row;
	}

	BOARD.important = [];

	for (let y = -1; y < BOARD.height; ++y) {
		for (let x = -1; x < BOARD.width; ++x) {
			let c00 = (BOARD.get(x,y) !== null);
			let c10 = (BOARD.get(x+1,y) !== null);
			let c01 = (BOARD.get(x,y+1) !== null);
			let c11 = (BOARD.get(x+1,y+1) !== null);

			if (c00 == c10 && c00 == c01 && c00 == c11) continue;

			BOARD.important.push({x:2*x+1, y:2*y+1, z:0.0});
		}
	}
}

loadBoard([
	"     ...     ",
	" ........... ",
	" ..nothing.. ",
	" .....   ... ",
	"    .......  ",
	"     ...     "
]);


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
};

function setMouse(evt) {
	const rect = CANVAS.getBoundingClientRect();
	MOUSE.at = {
		x:(evt.clientX - rect.left) / rect.width * 2.0 - 1.0,
		y:(evt.clientY - rect.bottom) / -rect.height * 2.0 - 1.0
	};
	queueUpdate();
}

MOUSE.getGrid = function MOUSE_getGrid() {
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
		return null;
	} else {
		const t = -origin.z / direction.z;
		return {
			x:Math.round(0.5 * (t * direction.x + origin.x)),
			y:Math.round(0.5 * (t * direction.y + origin.y))
		};
	}
}

function handleDown(gridPos) {
	if (!gridPos) return;
	if (BOARD.lifted) return; //can't re-lift
	const tile = BOARD.get(gridPos.x, gridPos.y);
	if (tile === null) return;
	if (tile.target) {
		tile.targetPos = {x:gridPos.x, y:gridPos.y};
		BOARD.lifted = tile;
	} else if (tile.letter && !tile.locked) {
		tile.targetPos = {x:gridPos.x, y:gridPos.y};
		BOARD.lifted = tile;
	}
	//TODO: check validity?
}

function moveLifted(gridPos) {
	if (!gridPos) return;
	if (!BOARD.lifted) return;
	if (BOARD.lifted.targetPos.x === gridPos.x && BOARD.lifted.targetPos.y === gridPos.y) return;
	BOARD.lifted.targetPos = {x:gridPos.x, y:gridPos.y};
	//TODO: check validity?
	queueUpdate();
}

function handleUp(gridPos) {
	if (!BOARD.lifted) return; //can't drop if not lifted
	moveLifted(gridPos);

	//drop anything invalid, already hope, or that would conflict:
	const target = BOARD.get(BOARD.lifted.targetPos.x, BOARD.lifted.targetPos.y);
	if (target === null || target === BOARD.lifted || target.letter) {
		delete BOARD.lifted.targetPos;
	}

	//drop anything overlapped:
	if (BOARD.lifted.targetPos) {
		BOARD.grid.forEach(function(row){
			row.forEach(function(tile){
				if (tile && tile !== BOARD.lifted && tile.targetPos && tile.targetPos.x === BOARD.lifted.targetPos.x && tile.targetPos.y === BOARD.lifted.targetPos.y) {
					delete tile.targetPos;
				}
			});
		});
	}

	//okay, no longer lifted:
	delete BOARD.lifted;

	//do a sweep for valid words to drop:
	while (true) {
		const text = new Array(BOARD.height);
		for (let y = 0; y < BOARD.height; ++y) {
			text[y] = new Array(BOARD.width);
			for (let x = 0; x < BOARD.width; ++x) {
				text[y][x] = null;
			}
		}

		BOARD.grid.forEach(function(row, y){
			row.forEach(function(tile, x){
				if (tile === null) return;
				if (tile.letter && !tile.targetPos) {
					console.assert(text[y][x] === null);
					text[y][x] = tile.letter;
				} else if (tile.targetPos) {
					const tx = tile.targetPos.x;
					const ty = tile.targetPos.y;
					console.assert(text[ty][tx] === null);
					text[ty][tx] = tile.letter.toUpperCase();
				}
			});
		});

		let bestWord = {
			x:-1, y:-1, dx:0, dy:0, word:"", value:0
		};
		for (let y = 0; y < BOARD.height; ++y) {
			for (let x = 0; x < BOARD.width; ++x) {
				if (text[y][x] === null) continue;
				function tryWord(dx,dy) {
					let iter = new WORDS.Iterator();
					let x2 = x;
					let y2 = y;
					let value = 0;
					while (x2 < BOARD.width && y2 < BOARD.height) {
						const c = text[y2][x2];
						if (c === null) break;
						iter.advance(c.toLowerCase());
						if (c.toUpperCase() === c) value += 1000;
						if (c.toLowerCase() === c) value += 1;
						if (iter.isWord() && (value % 1000 != 0) && (value >= 1000) && value > bestWord.value) {
							bestWord.x = x;
							bestWord.y = y;
							bestWord.dx = dx;
							bestWord.dy = dy;
							bestWord.word = iter.word;
							bestWord.value = value;
						}
						if (!iter.isPrefix()) break;
						x2 += dx;
						y2 += dy;
					}
				}
				tryWord(1,0);
				tryWord(0,-1);
			}
		}
		if (bestWord.value === 0) {
			break;
		}
		//set down everything in best word:
		console.log(bestWord.word);
		const min = {
			x:Math.min(bestWord.x, bestWord.x + bestWord.dx * (bestWord.word.length-1)),
			y:Math.min(bestWord.y, bestWord.y + bestWord.dy * (bestWord.word.length-1)),
		};
		const max = {
			x:Math.max(bestWord.x, bestWord.x + bestWord.dx * (bestWord.word.length-1)),
			y:Math.max(bestWord.y, bestWord.y + bestWord.dy * (bestWord.word.length-1)),
		};

		BOARD.grid.forEach(function(row, y){
			row.forEach(function(tile, x){
				if (tile === null) return;
				if (tile.targetPos
					&& tile.targetPos.x >= min.x && tile.targetPos.x <= max.x
					&& tile.targetPos.y >= min.y && tile.targetPos.y <= max.y) {
					const target = BOARD.get(tile.targetPos.x, tile.targetPos.y);
					console.assert(target);
					console.assert(!target.letter);
					target.letter = tile.letter;
					delete tile.letter;
					delete tile.targetPos;
				}
			});
		});
	}

	//TODO: check validity?
	//TODO: anything that's valid gets dropped
	//TODO: anything that's invalid [off board?] gets reset
	//TODO: anything that's maybe valid remains
}

window.addEventListener('mousemove', function(evt){
	evt.preventDefault();
	setMouse(evt);
	return false;
});
window.addEventListener('mousedown', function(evt){
	evt.preventDefault();
	setMouse(evt);

	handleDown(MOUSE.getGrid());
	return false;
});

window.addEventListener('mouseup', function(evt){
	evt.preventDefault();
	setMouse(evt);
	handleUp(MOUSE.getGrid());
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

		let min = {x:0.0, y:0.0};
		let max = {x:0.0, y:0.0};

		BOARD.important.forEach(function(pt){
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

		BOARD.important.forEach(function(pt){
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
	u.uTint = new Float32Array([1.0, 1.0, 1.0, 1.0]);

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

	for (let y = 0; y < BOARD.height; ++y) {
		for (let x = 0; x < BOARD.width; ++x) {
			let tile = BOARD.grid[y][x];
			if (tile === null) continue;
			drawModel(MODELS["Grid.Square"], {x:2.0*x, y:2.0*y, z:0.0});
			if (tile.letter) {
				let m = MODELS["Tile." + tile.letter.toUpperCase()];
				if (tile.targetPos) {
					u.uTint = new Float32Array([0.5, 0.5, 0.5, 1.0]);
					drawModel(m, {x:2.0*x, y:2.0*y, z:0.5});
					u.uTint = new Float32Array([0.7, 0.7, 0.6, 1.0]);
					drawModel(m, {x:2.0*tile.targetPos.x, y:2.0*tile.targetPos.y, z:0.5});
					u.uTint = new Float32Array([1.0, 1.0, 1.0, 1.0]);
				} else {
					drawModel(m, {x:2.0*x, y:2.0*y, z:0.0});
				}
			}
		}
	}
}
