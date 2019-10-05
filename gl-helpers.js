function setUniforms(program, uniforms) {
	gl.useProgram(program);

	var warned = setUniforms.warned || (setUniforms.warned = {});
	for (var name in uniforms) {
		//warn about unused uniforms:
		if (!(name in program)) {
			if (!(name in warned)) {
				console.warn("Uniform '" + name + "' specified, but not used in shaders.");
				warned[name] = true;
			}
		}
	}

	var nu = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
	for (var i = 0; i < nu; ++i) {
		var u = gl.getActiveUniform(program, i);
		var loc = gl.getUniformLocation(program, u.name);

		if (!(u.name in uniforms)) {
			//error if not specified:
			throw new Error("Uniform '" + u.name + "' used in shaders but not specified.");
		}
		var value = uniforms[u.name];
		if (u.type === gl.FLOAT) {
			if (value.length !== 1) {
				throw new Error("Uniform '" + u.name + "' is a float, but value given is of length " + value.length);
			}
			gl.uniform1fv(loc, value);
		} else if (u.type === gl.FLOAT_VEC2) {
			if (value.length !== 2) {
				throw new Error("Uniform '" + u.name + "' is a vec2, but value given is of length " + value.length);
			}
			gl.uniform2fv(loc, value);
		} else if (u.type === gl.FLOAT_VEC3) {
			if (value.length !== 3) {
				throw new Error("Uniform '" + u.name + "' is a vec3, but value given is of length " + value.length);
			}
			gl.uniform3fv(loc, value);
		} else if (u.type === gl.FLOAT_VEC4) {
			if (value.length !== 4) {
				throw new Error("Uniform '" + u.name + "' is a vec4, but value given is of length " + value.length);
			}
			gl.uniform4fv(loc, value);
		} else if (u.type === gl.INT) {
			if (value.length !== 1) {
				throw new Error("Uniform '" + u.name + "' is a int, but value given is of length " + value.length);
			}
			gl.uniform1iv(loc, value);
		} else if (u.type === gl.INT_VEC2) {
			if (value.length !== 2) {
				throw new Error("Uniform '" + u.name + "' is a ivec2, but value given is of length " + value.length);
			}
			gl.uniform2iv(loc, value);
		} else if (u.type === gl.INT_VEC3) {
			if (value.length !== 3) {
				throw new Error("Uniform '" + u.name + "' is a ivec3, but value given is of length " + value.length);
			}
			gl.uniform3iv(loc, value);
		} else if (u.type === gl.INT_VEC4) {
			if (value.length !== 4) {
				throw new Error("Uniform '" + u.name + "' is a ivec4, but value given is of length " + value.length);
			}
			gl.uniform4iv(loc, value);
		} else if (u.type === gl.FLOAT_MAT2) {
			if (value.length !== 2*2) {
				throw new Error("Uniform '" + u.name + "' is a mat2, but value given is of length " + value.length);
			}
			gl.uniformMatrix2fv(loc, false, value);
		} else if (u.type === gl.FLOAT_MAT3) {
			if (value.length !== 3*3) {
				throw new Error("Uniform '" + u.name + "' is a mat3, but value given is of length " + value.length);
			}
			gl.uniformMatrix3fv(loc, false, value);
		} else if (u.type === gl.FLOAT_MAT4) {
			if (value.length !== 4*4) {
				throw new Error("Uniform '" + u.name + "' is a mat4, but value given is of length " + value.length);
			}
			gl.uniformMatrix4fv(loc, false, value);
		} else if (u.type === gl.SAMPLER_2D) {
			if (value.length !== 1) {
				throw new Error("Uniform '" + u.name + "' is a sampler2D, but value given is of length " + value.length);
			}
			gl.uniform1iv(loc, value);

		} else {
			throw new Error("Uniform '" + u.name + "' has a type '" + u.type + "' not supported by this code.");
		}
	}
}
