"use strict";

const SHADERS = {
};

SHADERS.load = function SHADERS_load() {
	console.log("SHADERS.load");
	
	SHADERS.solid = initShaderProgram(gl,`
		attribute vec4 aPosition;
		attribute vec3 aNormal;
		attribute vec4 aColor;
		uniform mat4 uObjectToClip;
		uniform mat4 uObjectToLight;
		uniform mat3 uNormalToLight;
		varying vec3 vPosition;
		varying vec3 vNormal;
		varying vec4 vColor;
		void main() {
			gl_Position = uObjectToClip * aPosition;
			vPosition = vec3(uObjectToLight * aPosition);
			vNormal = uNormalToLight * aNormal;
			vColor = aColor;
		}
	`,`
		varying highp vec3 vPosition;
		varying mediump vec3 vNormal;
		varying lowp vec4 vColor;
		void main() {
			mediump vec3 n = normalize(vNormal);
			mediump vec3 l = vec3(0.0, 0.0, 1.0);
			mediump vec3 e = vec3(dot(n,l)*0.5+0.5);
			gl_FragColor = vec4(e*vColor.rgb, vColor.a);
			//gl_FragColor = vec4(vNormal * 0.5 + 0.5, 1.0);
		}
	`);
};


//Helper functions from MDN webgl tutorial:
// https://github.com/mdn/webgl-examples/blob/gh-pages/tutorial/sample2/webgl-demo.js

//
// Initialize a shader program, so WebGL knows how to draw our data
//
function initShaderProgram(gl, vsSource, fsSource) {
	const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
	const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

	// Create the shader program

	const shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);

	gl.bindAttribLocation(shaderProgram, 0, "aPosition");
	gl.bindAttribLocation(shaderProgram, 1, "aNormal");
	gl.bindAttribLocation(shaderProgram, 2, "aColor");
	gl.bindAttribLocation(shaderProgram, 3, "aTexCoord");

	gl.linkProgram(shaderProgram);

	// If creating the shader program failed, alert

	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		throw new Error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
		return null;
	}

	//from 15-466-f18's notes:
	//  http://graphics.cs.cmu.edu/courses/15-466-f18/notes/gl-helpers.js

	//store information about program attributes:
	var na = gl.getProgramParameter(shaderProgram, gl.ACTIVE_ATTRIBUTES);
	for (var i = 0; i < na; ++i) {
		var a = gl.getActiveAttrib(shaderProgram, i);
		shaderProgram[a.name] = {
			location:gl.getAttribLocation(shaderProgram, a.name),
			type:a.type,
			size:a.size
		};
	}

	//store information about program uniforms:
	var nu = gl.getProgramParameter(shaderProgram, gl.ACTIVE_UNIFORMS);
	for (var i = 0; i < nu; ++i) {
		var u = gl.getActiveUniform(shaderProgram, i);
		shaderProgram[u.name] = {
			location:gl.getUniformLocation(shaderProgram, u.name),
			type:u.type,
			size:u.size
		};
	}

	return shaderProgram;
}

//
// creates a shader of the given type, uploads the source and
// compiles it.
//
function loadShader(gl, type, source) {
	const shader = gl.createShader(type);

	// Send the source to the shader object

	gl.shaderSource(shader, source);

	// Compile the shader program

	gl.compileShader(shader);

	// See if it compiled successfully

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw new Error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}

	return shader;
}
