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

		MODELS.bindBuffer = function() {
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
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
		};

		//----- also create shadow volumes -----
		makeShadowVolumes(MODELS, data);

		callback();
	});
	xhr.addEventListener('error', function(){
		console.log("Error loading model.");
	});
	xhr.open("GET", "models/" + name);
	xhr.responseType = "arraybuffer";
	xhr.send();

};



//From http://graphics.cs.cmu.edu/courses/15-466-f17/notes/stencil-toy.html
// with modifications for data format
function makeShadowVolumes(MODELS, DATA) {
	"use strict";
	//Shadow volumes => geometric normals per face, duplicate edges

	const offset = 0;
	let stride = 3*4+3*4+4*1+2*4;
	console.assert(stride % 4 == 0, "Stride is easy to deal with.");
	stride /= 4;

	var vertex_count = 0;
	var attributes = [];

	function buildVolume(mesh){
		console.assert(mesh.count % 3 == 0, "Mesh is triangles.");

		var inds = {};
		var verts = [];
		function lookup(x,y,z) {
			var key = x.toString(16) + y.toString(16) + z.toString(16);
			if (!(key in inds)) {
				inds[key] = verts.length;
				verts.push([x,y,z]);
			}
			return inds[key];
		}

		var triangles = [];
		var halfEdges = [];
		var halfEdgesByKey = {};

		function addEdge(a,b, next, tri) {
			var halfEdge = {a:a, b:b, next:next, tri:tri};
			halfEdges.push(halfEdge);

			var key = a + "." + b;
			console.assert(!(key in halfEdgesByKey), "No duplicated edges, please.");
			halfEdgesByKey[key] = halfEdge;
		}

		//restrict to just the mesh's vertices:
		var data = new Float32Array(DATA.buffer, DATA.byteOffset + 4 * stride * mesh.start + offset, stride * mesh.count);
		for (var i = 0; i + 2 < mesh.count; i += 3) {
			var a = lookup(data[i*stride+0], data[i*stride+1], data[i*stride+2]);
			var b = lookup(data[(i+1)*stride+0], data[(i+1)*stride+1], data[(i+1)*stride+2]);
			var c = lookup(data[(i+2)*stride+0], data[(i+2)*stride+1], data[(i+2)*stride+2]);
			var va = {x:verts[a][0], y:verts[a][1], z:verts[a][2]};
			var vb = {x:verts[b][0], y:verts[b][1], z:verts[b][2]};
			var vc = {x:verts[c][0], y:verts[c][1], z:verts[c][2]};
			var normal = normalize( cross( sub(vb, va), sub(vc, va) ) );
			var tri = {
				verts:[a,b,c],
				normal:[normal.x, normal.y, normal.z]
			};
			addEdge(a,b, c, tri);
			addEdge(b,c, a, tri);
			addEdge(c,a, b, tri);
			triangles.push(tri);
		}
		console.log("  has " + verts.length + " unique vertices and " + triangles.length + " triangles.");

		//hook up edges:
		var boundary = [];
		halfEdges.forEach(function(edge){
			var overKey = edge.b + "." + edge.a;
			if (overKey in halfEdgesByKey) {
				edge.over = halfEdgesByKey[overKey];
			} else {
				boundary.push(edge);
			}
		});

		function addVertex(vert, norm) {
			attributes.push(vert[0], vert[1], vert[2], norm[0], norm[1], norm[2]);
			vertex_count += 1;
		}

		var vertex_start = vertex_count;

		//build two triangles to span each edge:
		halfEdges.forEach(function(edge){
			if (edge.over && edge.a > edge.b) return; //partner will build it
			var overNormal = (edge.over ? edge.over.tri.normal : [-edge.tri.normal[0], -edge.tri.normal[1], -edge.tri.normal[2]]);
			addVertex(verts[edge.a], edge.tri.normal);
			addVertex(verts[edge.a], overNormal);
			addVertex(verts[edge.b], edge.tri.normal);

			addVertex(verts[edge.b], edge.tri.normal);
			addVertex(verts[edge.a], overNormal);
			addVertex(verts[edge.b], overNormal);
		});

		//add triangles themselves:
		triangles.forEach(function(tri){
			addVertex(verts[tri.verts[0]], tri.normal);
			addVertex(verts[tri.verts[1]], tri.normal);
			addVertex(verts[tri.verts[2]], tri.normal);
		});

		if (boundary.length !== 0) {
			console.log("Note: mesh has " + boundary.length + " boundary edges, so adding all triangle back-faces.");
			//add back triangles:
			triangles.forEach(function(tri){
				var overNormal = [-tri.normal[0], -tri.normal[1], -tri.normal[2]];
				addVertex(verts[tri.verts[0]], overNormal);
				addVertex(verts[tri.verts[2]], overNormal);
				addVertex(verts[tri.verts[1]], overNormal);
			});

			//build two triangles to span each back edge:
			halfEdges.forEach(function(edge){
				if (!(edge.over)) return;
				if (edge.a > edge.b) return; //partner will build it
				var normal = edge.tri.normal;
				var overNormal = edge.over.tri.normal;
				normal = [-normal[0], -normal[1], -normal[2]];
				overNormal = [-overNormal[0], -overNormal[1], -overNormal[2]];
				addVertex(verts[edge.a], normal);
				addVertex(verts[edge.b], normal);
				addVertex(verts[edge.a], overNormal);

				addVertex(verts[edge.b], normal);
				addVertex(verts[edge.b], overNormal);
				addVertex(verts[edge.a], overNormal);
			});
		}

		var vertex_end = vertex_count;

		mesh.shadow_start = vertex_start;
		mesh.shadow_count = vertex_end - vertex_start;

	}

	for (let name in MODELS) {
		const mesh = MODELS[name];
		if (typeof(mesh) !== 'object' || !('start' in mesh)) continue;
		console.log("Mesh " + mesh.name + ":");
		buildVolume(mesh);
	}

	let buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(attributes), gl.STATIC_DRAW);

	MODELS.bindShadowBuffer = function() {
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

		const stride = 3*4+3*4;

		//0 => Position
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
		//1 => Normal
		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3*4);
		//2 => Color
		gl.disableVertexAttribArray(2);
		//3 => TexCoord
		gl.disableVertexAttribArray(2);
	};

	console.log("Created " + vertex_count + " shadow vertices.");
}

