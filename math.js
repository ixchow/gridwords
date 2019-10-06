"use strict";

//Mostly from 15-466:
// http://graphics.cs.cmu.edu/courses/15-466-f18/notes/brdf-toy.html

//quaternion rotation:
function angleAxis(angle, x,y,z) {
	const axis = normalize({x:x, y:y, z:z});
	const ca2 = Math.cos(angle/2);
	const sa2 = Math.sin(angle/2);
	return { x:sa2*axis.x, y:sa2*axis.y, z:sa2*axis.z, w:ca2 };
}

function quat2mat4(q) {
	//Based on glm's gtx/quaternion.inl :

	const ww = q.w*q.w;
	const wx = q.w*q.x;
	const wy = q.w*q.y;
	const wz = q.w*q.z;
	const xx = q.x*q.x;
	const xy = q.x*q.y;
	const xz = q.x*q.z;
	const yy = q.y*q.y;
	const yz = q.y*q.z;
	const zz = q.z*q.z;

	return new Float32Array([
		1.0 - 2.0 * (yy + zz), 2.0 * (xy + wz), 2.0 * (xz - wy), 0.0,
		2.0 * (xy - wz), 1.0 - 2.0 * (xx + zz), 2.0 * (yz + wx), 0.0,
		2.0 * (xz + wy), 2.0 * (yz - wx), 1.0 - 2.0 * (xx + yy), 0.0,
		0.0, 0.0, 0.0, 1.0
	]);
}

function quatMul(q,r) {
	let ret = cross(q,r);
	ret.x += q.x*r.w + r.x*q.w;
	ret.y += q.y*r.w + r.y*q.w;
	ret.z += q.z*r.w + r.z*q.w;
	ret.w = q.w*r.w - q.x*r.x - q.y*r.y - q.z*r.z;
	return ret;
}

function mix(a, b, t) {
	return {
		x:(b.x - a.x) * t + a.x,
		y:(b.y - a.y) * t + a.y,
		z:(b.z - a.z) * t + a.z
	};
}
function dot(a, b) {
	return a.x * b.x + a.y * b.y + a.z * b.z;
}
function sub(a, b) {
	return {
		x: a.x - b.x,
		y: a.y - b.y,
		z: a.z - b.z
	};
}
function cross(a, b) {
	return {
		x: a.y * b.z - a.z * b.y,
		y: a.z * b.x - a.x * b.z,
		z: a.x * b.y - a.y * b.x
	};
}
function normalize(vec) {
	var len = Math.sqrt(dot(vec, vec));
	return { x:vec.x / len, y:vec.y / len, z:vec.z / len };
}
function lookAt(eye, target, up) {
	var out = normalize({ x:eye.x - target.x, y:eye.y - target.y, z:eye.z - target.z });
	var proj = dot(up, out);
	up = normalize({ x:up.x - proj * out.x, y:up.y - proj * out.y, z:up.z - proj * out.z });

	var right = cross(up, out);

	var offset = { x: -dot(eye, right), y: -dot(eye, up), z: -dot(eye, out) };

	return new Float32Array([
		right.x, up.x, out.x, 0.0,
		right.y, up.y, out.y, 0.0,
		right.z, up.z, out.z, 0.0,
		offset.x, offset.y, offset.z, 1.0
	]);
	
}
function perspective(fovy, aspect, zNear) {
	var f = 1 / Math.tan(fovy/2 * Math.PI / 180.0);
	return new Float32Array([
		f / aspect, 0.0, 0.0, 0.0,
		0.0, f, 0.0, 0.0,
		0.0, 0.0, -1, -1,
		0.0, 0.0, -2*zNear, 0.0
	]);
}
function mul(A, B) {
	var out = new Float32Array(16);
	for (var r = 0; r < 4; ++r) {
		for (var c = 0; c < 4; ++c) {
			var val = 0.0;
			for (var k = 0; k < 4; ++k) {
				val += A[k * 4 + r] * B[c * 4 + k];
			}
			out[4 * c + r] = val;
		}
	}
	return out;
}
