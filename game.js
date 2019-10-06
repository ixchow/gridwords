"use string";
//Based, in part, on the MDN webGL tutorials:
// https://threejs.org/build/three.min.js
//and also based on the 15-466-f18 notes:
// http://graphics.cs.cmu.edu/courses/15-466-f18/notes/gl-helpers.js
// http://graphics.cs.cmu.edu/courses/15-466-f18/notes/brdf-toy.html
//and some helpers from on-forgetting:
// https://github.com/ixchow/on-forgetting


const UNDO = document.getElementById("undo");
const RESET = document.getElementById("reset");
const PREV = document.getElementById("prev");
const NEXT = document.getElementById("next");
const TITLE = document.getElementById("title");

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
		if (loading == 0) {
			if (document.location.search.match(/^\?\d+/)) {
				setLevel(parseInt(document.location.search.substr(1)));
			} else {
				setLevel(0);
			}
		}
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
	grid:[],
	width:0,
	height:0,
	important:[],
	history:[],
	get:function BOARD_get(x,y) {
		if (x < 0 || x >= this.width) return null;
		if (y < 0 || y >= this.height) return null;
		return this.grid[y][x];
	},
	pushHistory:function BOARD_pushHistory() {
		if (this.lifted) return;
		let val = JSON.stringify(this.grid);
		if (this.history.length === 0 || val !== this.history[this.history.length-1]) {
			this.history.push(val);
		}
	},
	popHistory:function BOARD_popHistory() {
		delete this.lifted;
		//trim states that match current state:
		this.current = JSON.stringify(this.grid);
		while (this.history.length > 1 && this.history[this.history.length-1] === this.current) {
			this.history.pop();
		}
		//grab next state:
		this.grid = JSON.parse(this.history[this.history.length-1]);
		if (this.history.length > 1) {
			this.history.pop();
		}
	},
	reset:function BOARD_reset() {
		if (this.lifted) return;
		this.grid = JSON.parse(this.history[0]);
	}
};

function loadBoard(arr) {
	delete BOARD.lifted;

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
				row[x].goal = true;
			} else if (arr[y][x] === '*') {
				row[x].goal = true;
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

	BOARD.history = [];

	setLocked();

	BOARD.pushHistory();
}


let CURRENT_LEVEL = -1;
let MAX_LEVEL = 0;

function setLevel(N) {
	if (N < 0 || N >= LEVELS.length) {
		return;
	}
	if (CURRENT_LEVEL === N) {
		return;
	}
	CURRENT_LEVEL = N;

	if (history && history.replaceState) history.replaceState({},"","?" + CURRENT_LEVEL);
	MAX_LEVEL = Math.max(MAX_LEVEL, CURRENT_LEVEL);
	loadBoard(LEVELS[CURRENT_LEVEL].board);
	TITLE.innerText = "❝" + LEVELS[N].title + "❞";
	if (CURRENT_LEVEL == 0) {
		PREV.classList.add("disabled");
	} else {
		PREV.classList.remove("disabled");
	}
	if (CURRENT_LEVEL == MAX_LEVEL) {
		NEXT.classList.add("disabled");
	} else {
		NEXT.classList.remove("disabled");
	}
}


function prevLevel() {
	if (CURRENT_LEVEL > 0) {
		setLevel(CURRENT_LEVEL-1);
		queueUpdate();
	}
}

function nextLevel() {
	if (CURRENT_LEVEL < MAX_LEVEL) {
		setLevel(CURRENT_LEVEL+1);
		queueUpdate();
	}
}

function undo() {
	BOARD.popHistory();
	setLocked();
	queueUpdate();
}

function reset() {
	BOARD.pushHistory();
	BOARD.reset();
	setLocked();
	queueUpdate();
}


const CAMERA = {
	fovy:15.0,
	aspect:1.0,
	near:10.0,
	target:{x:0.0, y:0.0, z:0.0},
	radius:30.0,
	azimuth:0.005 * Math.PI,
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
	BOARD.pushHistory();

	let source = null;
	BOARD.grid.forEach(function(row){
		row.forEach(function(tile){
			if (tile && tile.targetPos && tile.targetPos.x === gridPos.x && tile.targetPos.y === gridPos.y) {
				source = tile;
			}
		});
	});
	if (source) {
		BOARD.lifted = source;
	} else if (tile.letter && !tile.locked) {
		BOARD.lifted = tile;
	}
	if (BOARD.lifted) {
		console.log(gridPos);
		moveLifted(gridPos);
		console.log(BOARD.lifted.targetPos.x, BOARD.lifted.targetPos.y);
	}
}

function moveLifted(gridPos) {
	if (!gridPos) return;
	if (!BOARD.lifted) return;
	if (BOARD.lifted.targetPos && BOARD.lifted.targetPos.x === gridPos.x && BOARD.lifted.targetPos.y === gridPos.y) return;
	BOARD.lifted.targetPos = {x:gridPos.x, y:gridPos.y};
	console.log("-->", BOARD.lifted.targetPos.x, BOARD.lifted.targetPos.y);
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

	//will either drop *everything* or drop *nothing*.
	//Will drop *everything* if every new word is:
	// (a) supported (== 4-neighbor connected to unlocked tile)
	// (b) valid (== x and y chains are both words)

	//fill in text to make it easier to sweep:
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

	//do "supported" with flood-fill:
	const supported = new Array(BOARD.height);
	for (let y = 0; y < BOARD.height; ++y) {
		supported[y] = new Array(BOARD.width);
	}
	{
		const todo = [];
		function support(x,y) {
			if (x < 0 || x >= BOARD.width || y < 0 || y >= BOARD.height) return;
			if (!text[y][x]) return;
			if (supported[y][x]) return;
			supported[y][x] = true;
			todo.push({x:x-1,y:y});
			todo.push({x:x+1,y:y});
			todo.push({x:x,y:y-1});
			todo.push({x:x,y:y+1});
		}
		BOARD.grid.forEach(function(row, y){
			row.forEach(function(tile, x){
				if (tile && tile.letter && !tile.targetPos && !tile.locked) {
					support(x,y);
				}
			});
		});
		while (todo.length) {
			let at = todo.shift();
			support(at.x, at.y);
		}
	}
	let allSupported = true;
	for (let y = 0; y < BOARD.height; ++y) {
		for (let x = 0; x < BOARD.width; ++x) {
			if (text[y][x] && text[y][x].toUpperCase() == text[y][x] && !supported[y][x]) {
				allSupported = false;
			}
		}
	}


	//do "valid" with WORDS:
	let allValid = true;
	for (let y = 0; y < BOARD.height; ++y) {
		for (let x = 0; x < BOARD.width; ++x) {
			function tryWord(dx,dy) {
				let x1 = x;
				let y1 = y;
				while (x1-dx >= 0 && x1-dx < BOARD.width && y1-dy >= 0 && y1-dy < BOARD.height && text[y1-dy][x1-dx] !== null) {
					x1 -= dx;
					y1 -= dy;
				}

				let x2 = x1;
				let y2 = y1;

				let iter = new WORDS.Iterator();
				while (x2 >= 0 && x2 < BOARD.width && y2 >= 0 && y2 < BOARD.height) {
					const c = text[y2][x2];
					if (c === null) break;
					iter.advance(c.toLowerCase());
					x2 += dx;
					y2 += dy;
				}
				console.assert(iter.word.length >= 1);
				return (iter.word.length === 1 || iter.isWord());
			}
			if (text[y][x] && text[y][x].toUpperCase() === text[y][x] && !(tryWord(1,0) && tryWord(0,-1))) {
				//not valid
				allValid = false;
			}
		}
	}

	if (allSupported && allValid) {
		BOARD.grid.forEach(function(row, y){
			row.forEach(function(tile, x){
				if (tile === null) return;
				if (tile.targetPos) {
					const target = BOARD.get(tile.targetPos.x, tile.targetPos.y);
					console.assert(target);
					console.assert(!target.letter);
					target.letter = tile.letter;
					delete tile.letter;
					delete tile.targetPos;
				}
			});
		});
		setLocked();
	}

	checkWin();
}

function checkWin() {
	//check win condition
	let goals = 0;
	let filled = 0;
	let up = 0;
	BOARD.grid.forEach(function(row, y){
		row.forEach(function(tile, x){
			if (tile === null) return;
			if (tile.goal) {
				++goals;
				if (tile.letter && !tile.locked && !tile.targetPos) {
					++filled;
				}
			}
			if (tile.targetPos) {
				++up;
			}
		});
	});
	if (up === 0 && filled === goals) {
		MAX_LEVEL = Math.max(MAX_LEVEL, CURRENT_LEVEL + 1);
		NEXT.classList.remove("disabled");
	}
}

function setLocked() {
	let moving = false;
	BOARD.grid.forEach(function(row, y){
		row.forEach(function(tile, x){
			if (tile === null) return;
			if (tile.targetPos) {
				moving = true;
			}
		});
	});
	if (moving) return;

	//mark everything unlocked:
	BOARD.grid.forEach(function(row, y){
		row.forEach(function(tile, x){
			if (tile === null) return;
			delete tile.locked;
			delete tile.xValid;
			delete tile.yValid;
		});
	});

	for (let y = 0; y < BOARD.height; ++y) {
		for (let x = 0; x < BOARD.width; ++x) {
			function hasLetter(x,y) {
				const tile = BOARD.get(x,y);
				return tile && tile.letter;
			}
			//check x:
			if (!hasLetter(x-1,y)) {
				let iter = new WORDS.Iterator();
				let x2 = x;
				while (hasLetter(x2,y)) {
					iter.advance(BOARD.grid[y][x2].letter);
					++x2;
				}
				if (iter.isWord()) {
					for (let i = x; i < x2; ++i) {
						BOARD.grid[y][i].xValid = iter.word;
					}
				} else if (iter.word.length === 1) {
					BOARD.grid[y][x].xValid = 1;
				}
			}
			//check y:
			if (!hasLetter(x,y+1)) {
				let iter = new WORDS.Iterator();
				let y2 = y;
				while (hasLetter(x,y2)) {
					iter.advance(BOARD.grid[y2][x].letter);
					--y2;
				}
				if (iter.isWord()) {
					for (let i = y; i > y2; --i) {
						BOARD.grid[i][x].yValid = iter.word;
					}
				} else if (iter.word.length === 1) {
					BOARD.grid[y][x].yValid = 1;
				}
			}
		}
	}

	//mark valid based on xValid and yValid:
	BOARD.grid.forEach(function(row, y){
		row.forEach(function(tile, x){
			if (tile === null) return;
			if (tile.letter === null) return;
			if (tile.xValid && tile.yValid && (tile.xValid !== 1 || tile.yValid !== 1)) {
				//great!
			} else {
				tile.locked = true;
			}
			//delete tile.xValid;
			//delete tile.yValid;
		});
	});

}


window.addEventListener('mousemove', function(evt){
	evt.preventDefault();
	setMouse(evt);
	if (BOARD.lifted) {
		moveLifted(MOUSE.getGrid());
	}
	return false;
});
window.addEventListener('mousedown', function(evt){
	evt.preventDefault();
	setMouse(evt);

	if (evt.target === CANVAS) {
		handleDown(MOUSE.getGrid());
	}
	return false;
});
window.addEventListener('click', function(evt){
	evt.preventDefault();
	if (evt.target === PREV) {
		prevLevel();
	} else if (evt.target === NEXT) {
		nextLevel();
	} else if (evt.target === UNDO) {
		undo();
	} else if (evt.target === RESET) {
		reset();
	}
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

const MISC_BUFFER = gl.createBuffer();

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
	u.uTint = new Float32Array([1.0, 1.0, 1.0, 0.0]);
	u.uSaturate = new Float32Array([1.0]);

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

	let arrowAttribs = [];

	function drawArrow(a, b, color) {
		let along = { x:b.x-a.x, y:b.y-a.y, z:b.z-a.z };
		let len = Math.sqrt(dot(along,along));
		let norm = normalize(along);
		let perp = normalize({ x:-along.y, y:along.x, z:0.0});

		const ra = 0.6 / len;
		function pt(amt, ofs) {
			let a2 = Math.max(0.0, Math.min(1.0, (amt - ra) / (1 - 2.0*ra)));
			let boost = (1.0 - (2.0 * (a2 - 0.5)) ** 2) * Math.min(1.0, 0.1 * len);
			arrowAttribs.push(
				along.x*amt+a.x + ofs*perp.x,
				along.y*amt+a.y + ofs*perp.y,
				along.z*amt+a.z + ofs*perp.z + boost,
				...color
			);
		}
		const ha = 0.3 / len;
		const hr = 0.18;
		const r = 0.05;

		pt(ra, 0.0);
		pt(ra, 0.0);
		pt(ra + r / len, -r);
		pt(ra + r / len,  r);

		for (let s = 0; s < 5; ++s) {
			let amt = ra+r + ((1.0-ra-ha) - (ra+r)) * (s+0.5)/5;
			pt(amt, -r);
			pt(amt, r);
		}

		pt(1.0-ra - ha, -r);
		pt(1.0-ra - ha,  r);

		pt(1.0-ra - ha, -hr);
		pt(1.0-ra - ha,  hr);
		pt(1.0-ra, 0.0);
		pt(1.0-ra, 0.0);
	};

	MODELS.bindBuffer();

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
			if (tile.goal) {
				if (tile.letter && !tile.locked && !tile.targetPos) {
					u.uSaturate = new Float32Array([1.0]);
				} else {
					u.uSaturate = new Float32Array([0.0]);
				}
				drawModel(MODELS["Grid.Goal"], {x:2.0*x, y:2.0*y, z:0.0});
				u.uSaturate = new Float32Array([1.0]);
			} else {
				drawModel(MODELS["Grid.Square"], {x:2.0*x, y:2.0*y, z:0.0});
			}
			if (tile.letter) {
				let m = MODELS["Tile." + tile.letter.toUpperCase()];
				if (tile.targetPos) {
					const z = (BOARD.lifted === tile ? 0.6 : 0.5);
					u.uTint = new Float32Array([1.0, 1.0, 1.0, 0.5]);
					drawModel(m, {x:2.0*x, y:2.0*y, z:0.5});
					const target = BOARD.get(tile.targetPos.x, tile.targetPos.y);
					let arrowColor;
					if (target && !target.letter) {
						u.uTint = new Float32Array([1.0, 1.0, 1.0, 0.0]);
						drawModel(m, {x:2.0*tile.targetPos.x, y:2.0*tile.targetPos.y, z:z});
						arrowColor = [0.1, 0.1, 0.07, 1.0];
					} else {
						arrowColor = [0.8, 0.2, 0.5, 1.0];
					}
					u.uTint = new Float32Array([1.0, 1.0, 1.0, 0.0]);

					const h = 0.23

					drawArrow({x:2.0*x, y:2.0*y, z:0.5+h}, {x:2.0*tile.targetPos.x, y:2.0*tile.targetPos.y, z:z+h}, arrowColor);
				} else {
					if (tile.locked) {
						u.uSaturate = new Float32Array([0.0]);
						u.uTint = new Float32Array([0.0, 0.0, 0.0, 0.3]);
					}
					drawModel(m, {x:2.0*x, y:2.0*y, z:0.0});
					u.uSaturate = new Float32Array([1.0]);
					u.uTint = new Float32Array([1.0, 1.0, 1.0, 0.0]);
				}
			}
		}
	}

	gl.enable(gl.BLEND);
	gl.blendEquation(gl.FUNC_ADD);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

	if (arrowAttribs.length) {
		const objectToWorld = new Float32Array([
			1.0, 0.0, 0.0, 0.0,
			0.0, 1.0, 0.0, 0.0,
			0.0, 0.0, 1.0, 0.0,
			0.0, 0.0, 0.0, 1.0
		]);

		u.uObjectToClip = mul(worldToClip, objectToWorld);
		u.uObjectToLight = objectToWorld;

		const normalToWorld = new Float32Array([
			objectToWorld[0], objectToWorld[1], objectToWorld[2],
			objectToWorld[4], objectToWorld[5], objectToWorld[6],
			objectToWorld[8], objectToWorld[9], objectToWorld[10]
		]);
		u.uNormalToLight = normalToWorld;

		u.uSaturate = new Float32Array([1.0]);
		u.uTint = new Float32Array([1.0, 1.0, 1.0, 0.0]);

		setUniforms(prog, u);

		//upload and draw arrow attribs:
		gl.bindBuffer(gl.ARRAY_BUFFER, MISC_BUFFER);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrowAttribs), gl.STREAM_DRAW);

		const stride = 3*4+4*4;
		//0 => Position
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
		//1 => Normal
		gl.disableVertexAttribArray(1);
		gl.vertexAttrib3f(1, 0.0, 0.0, 1.0);
		//gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3*4);
		//2 => Color
		gl.enableVertexAttribArray(2);
		gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 3*4);
		//3 => TexCoord
		gl.disableVertexAttribArray(3);
		gl.vertexAttrib2f(3, 0.0, 0.0);
		//gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 3*4+3*4+4*1);

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, arrowAttribs.length/(stride/4));
	}

	gl.disable(gl.BLEND);

}


