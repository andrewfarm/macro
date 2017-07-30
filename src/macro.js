const MIN_GALAXIES = 2;
const MAX_GALAXIES = 2;
const MIN_STARS_IN_GALAXY = 1000;
const MAX_STARS_IN_GALAXY = 1000;

const INITIAL_BOUNDS = 500.0;
const INITIAL_SPEED_LIMIT = 2.0;
const BLACK_HOLE_GRAVITY = 1000.0;

const BH_VERT = '\
uniform mat4 u_mvp_matrix;\n\
\n\
attribute vec3 a_pos;\n\
\n\
void main() {\n\
        gl_Position = u_mvp_matrix * vec4(a_pos, 1.0);\n\
        gl_PointSize = 10000.0 / gl_Position.z;\n\
}\n\
';

const BH_FRAG = '\
precision mediump float;\n\
\n\
void main() {\n\
        gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);\n\
}\n\
';

const STAR_VERT = '\
precision mediump float;\n\
\n\
uniform mat4 u_mvp_matrix;\n\
uniform sampler2D u_star_pos;\n\
uniform float u_star_res;\n\
\n\
attribute float a_index;\n\
\n\
float colorToFloat32(vec4 color) {\n\
        int integer  = int(floor(color.g * 255.0)) * 256 + int(floor(color.r * 255.0)) - 32768;\n\
        int fraction = int(floor(color.a * 255.0)) * 256 + int(floor(color.b * 255.0));\n\
        return float(integer) + (float(fraction) / 65535.0);\n\
}\n\
\n\
void main() {\n\
        vec4 xColor = texture2D(u_star_pos, vec2((a_index) / u_star_res, 0.0));\n\
        vec4 yColor = texture2D(u_star_pos, vec2((a_index + 1.0) / u_star_res, 0.0));\n\
        vec4 zColor = texture2D(u_star_pos, vec2((a_index + 2.0) / u_star_res, 0.0));\n\
        gl_Position = u_mvp_matrix * vec4(1.0 * vec3(\n\
                colorToFloat32(xColor),\n\
                colorToFloat32(yColor),\n\
                colorToFloat32(zColor)),\n\
                1.0);\n\
        gl_PointSize = 2000.0 / gl_Position.z;\n\
}\n\
';

const STAR_FRAG = '\
precision mediump float;\n\
\n\
void main() {\n\
        gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0);\n\
}\n\
';

const QUAD_VERT = '\
precision mediump float;\n\
\n\
attribute vec2 a_pos;\n\
\n\
varying vec2 v_tex_pos;\n\
\n\
void main() {\n\
        v_tex_pos = a_pos;\n\
        gl_Position = vec4(1.0 - 2.0 * a_pos, 0, 1);\n\
}\n\
';

const STAR_UPDATE_FRAG = '\
\n\
uniform sampler2D u_star_pos;\n\
uniform sampler2D u_star_vel;\n\
\n\
varying vec2 v_tex_pos;\n\
\n\
void main() {\n\
}\n\
';

function randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
        return Math.random() * (max - min) + min;
}

function storeFloatAsFixed32(buf, offset /* in floats */, f) {
        const bufView = new Uint16Array(buf);
        var integer = Math.floor(f);
        if ((integer < -0x8000) || (integer > 0x7FFF)) {
                throw 'value too big: ' + integer + ': must be in the range  [-32768, 32768)';
        }
        var fraction = f - integer;
        bufView[offset * 2] = integer + 0x8000;
        bufView[offset * 2 + 1] = Math.floor(fraction * 0xFFFF);
        console.log('stored value ' + f + ': integer: ' + (integer + 0x8000) + ', fraction: ' + Math.floor(fraction * 0xFFFF) + '/65536');
}

class BlackHole {
        constructor() {
                this.pos = vec3.fromValues(
                        randFloat(0, INITIAL_BOUNDS),
                        randFloat(0, INITIAL_BOUNDS),
                        randFloat(0, INITIAL_BOUNDS));
                this.vel = vec3.fromValues(
                        randFloat(0, INITIAL_SPEED_LIMIT),
                        randFloat(0, INITIAL_SPEED_LIMIT),
                        randFloat(0, INITIAL_SPEED_LIMIT));
        }
}

class Universe {
        constructor(gl) {
                this.gl = gl;
                
                this.quadBuffer = createBuffer(gl, new Float32Array(
                        [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));
                this.framebuffer = gl.createFramebuffer();
                
                this.blackHoleShaderProgram = createProgram(gl, BH_VERT, BH_FRAG);
                this.starShaderProgram = createProgram(gl, STAR_VERT, STAR_FRAG);
//                this.starUpdateShaderProgram = createProgram(
//                        gl, QUAD_VERT, STAR_UPDATE_FRAG);
                
                this.modelMatrix = mat4.identity(mat4.create());
                this.viewMatrix = mat4.lookAt(mat4.create(),
                        vec3.fromValues(0.0, 0.0, INITIAL_BOUNDS * 2.0),
                        vec3.fromValues(0.0, 0.0, 0.0),
                        vec3.fromValues(0.0, 1.0, 0.0));
                this.projectionMatrix = mat4.perspective(mat4.create(),
                        Math.PI / 3.0, window.innerWidth / window.innerHeight, 1.0, 10000.0);
                
                this.mvpMatrix = mat4.multiply(
                        mat4.create(), this.viewMatrix, this.modelMatrix);
                this.mvpMatrix = mat4.multiply(
                        this.mvpMatrix, this.projectionMatrix, this.mvpMatrix);
                
                this.starCount = 0;
                this.blackHoles = [];
                this.genesis();
                
//                //test
//                var arraybuf = new ArrayBuffer(4);
//                var originalValue = 32767.5;
//                storeFloatAsFixed32(arraybuf, 0, originalValue);
//                console.log('original value', originalValue);
//                var view = new Uint16Array(arraybuf);
//                console.log('integer', view[0]);
//                console.log('fraction', view[1]);
        }
        
        genesis() {
                //generate galaxy sizes
                var galaxySizes = [];
                const galaxyCount = randInt(MIN_GALAXIES, MAX_GALAXIES);
                for (var i = 0; i < galaxyCount; i++) {
                        galaxySizes[i] = randInt(MIN_STARS_IN_GALAXY, MAX_STARS_IN_GALAXY);
                        this.starCount += galaxySizes[i];
                }
                
                //generate galaxies
                
                //allocate star position and velocity buffers
                const TEXELS_PER_STAR = 4;
                this.STAR_TEXEL_COUNT = this.starCount * TEXELS_PER_STAR;
                this.STAR_BYTE_COUNT = this.STAR_TEXEL_COUNT * 4;
                var starPosBuf =  new ArrayBuffer(this.STAR_BYTE_COUNT);
                var starVelBuf = new ArrayBuffer(this.STAR_BYTE_COUNT);
                
                var arrayOffset = 0;
                var galaxyRadius;
                var starDist, starAngle;
                var starPosX, starPosY, starPosZ;
                var starSpeed;
                var starVelX, starVelY, starVelZ;
                for (var i = 0; i < galaxyCount; i++) {
                        this.blackHoles[i] = new BlackHole();
                        
                        //generate stars
                        galaxyRadius = galaxySizes[i] * 0.2; //TODO
                        for (var j = 0; j < galaxySizes[i]; j++) {
                                starDist = randFloat(0, galaxyRadius);
                                starAngle = randFloat(0, 2.0 * Math.PI);
                                starPosX = starDist * Math.cos(starAngle);
                                starPosY = starDist * Math.sin(starAngle);
                                starPosZ = 0.0;
                                starSpeed = Math.sqrt(BLACK_HOLE_GRAVITY / starDist);
                                starVelX = starSpeed * -Math.sin(starAngle);
                                starVelY = starSpeed *  Math.cos(starAngle);
                                starVelZ = 0.0;
                                
                                storeFloatAsFixed32(starPosBuf, arrayOffset,
                                        this.blackHoles[i].pos[0] + starPosX);
                                storeFloatAsFixed32(starPosBuf, arrayOffset + 1,
                                        this.blackHoles[i].pos[1] + starPosY);
                                storeFloatAsFixed32(starPosBuf, arrayOffset + 2,
                                        this.blackHoles[i].pos[2] + starPosZ);
                                storeFloatAsFixed32(starPosBuf, arrayOffset + 3, 1.0);
                                
                                storeFloatAsFixed32(starVelBuf, arrayOffset,
                                        this.blackHoles[i].vel[0] + starVelX);
                                storeFloatAsFixed32(starVelBuf, arrayOffset + 1,
                                        this.blackHoles[i].vel[1] + starVelY);
                                storeFloatAsFixed32(starVelBuf, arrayOffset + 2,
                                        this.blackHoles[i].vel[2] + starVelZ);
                                storeFloatAsFixed32(starVelBuf, arrayOffset + 3, 1.0);
                                
                                arrayOffset += 4;
                        }
                }
                
                //create views of buffers as Uint8 arrays
                const starPosUint8 = new Uint8Array(starPosBuf);
                const starVelUint8 = new Uint8Array(starVelBuf);
                console.log('starPosUint8', starPosUint8);
                
                //store star states in textures
                const gl = this.gl;
                this.starPosTexture = createTexture(gl, gl.NEAREST,
                        starPosUint8, this.STAR_TEXEL_COUNT, 1);
                this.starVelTexture = createTexture(gl, gl.NEAREST,
                        starVelUint8, this.STAR_TEXEL_COUNT, 1);
                
                //store star indices in buffer
                var starIndices = new Float32Array(this.starCount);
                for (var i = 0; i < this.starCount; i++) {
                        starIndices[i] = i * TEXELS_PER_STAR;
                }
                this.starIndexBuffer = createBuffer(gl, starIndices);
                
                console.log('created ' + galaxyCount + ' galaxies and ' +
                        this.starCount + ' stars');
        }
        
        nextFrame() {
                this.draw();
                this.update();
        }
        
        draw() {
                const gl = this.gl;
                gl.enable(gl.DEPTH_TEST);
                gl.depthFunc(gl.LESS);
                gl.disable(gl.STENCIL_TEST);
                
                bindFramebuffer(gl, null);
                gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
                gl.clearColor(0.0, 0.0, 0.0, 1.0);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                
                this.drawBlackHoles();
                this.drawStars();
        }
        
        drawBlackHoles() {
                const gl = this.gl;
                
                var blackHolePositions = new Float32Array(this.blackHoles.length * 3);
                var arrayOffset = 0;
                for (var bh of this.blackHoles) {
                        blackHolePositions[arrayOffset++] = bh.pos[0];
                        blackHolePositions[arrayOffset++] = bh.pos[1];
                        blackHolePositions[arrayOffset++] = bh.pos[2];
                }
                const blackHolePosBuffer = createBuffer(gl, blackHolePositions);
                
                gl.useProgram(this.blackHoleShaderProgram.program);
                gl.uniformMatrix4fv(this.blackHoleShaderProgram.u_mvp_matrix,
                        false, this.mvpMatrix);
                bindAttribute(gl, blackHolePosBuffer, this.blackHoleShaderProgram.a_pos, 3);
                gl.drawArrays(gl.POINTS, 0, this.blackHoles.length);
                
                gl.deleteBuffer(blackHolePosBuffer);
        }
        
        drawStars() {
                const gl = this.gl;
                gl.useProgram(this.starShaderProgram.program);
                bindAttribute(gl, this.starIndexBuffer, this.starShaderProgram.a_index, 1);
                bindTexture(gl, this.starPosTexture, 0);
                gl.uniformMatrix4fv(this.starShaderProgram.u_mvp_matrix,
                        false, this.mvpMatrix);
                gl.uniform1i(this.starShaderProgram.u_star_pos, 0);
                gl.uniform1f(this.starShaderProgram.u_star_res, this.STAR_TEXEL_COUNT);
                gl.drawArrays(gl.POINTS, 0, this.starCount);
        }
        
        update() {
                this.updateBlackHoles();
                this.updateStars();
        }
        
        updateBlackHoles() {
                var acc;
                for (var i = 0; i < this.blackHoles.length; i++) {
                        for (var j = i + 1; j < this.blackHoles.length; j++) {
                                acc = vec3.create();
                                vec3.subtract(acc, this.blackHoles[i].pos, this.blackHoles[j].pos);
                                vec3.scale(acc, acc, BLACK_HOLE_GRAVITY /
                                        (vec3.length(acc) * vec3.squaredLength(acc)));
                                vec3.add(this.blackHoles[j].vel, this.blackHoles[j].vel, acc);
                                vec3.subtract(this.blackHoles[i].vel, this.blackHoles[i].vel, acc);
                        }
                }
                
                for (var bh of this.blackHoles) {
                        vec3.add(bh.pos, bh.pos, bh.vel);
                }
        }
        
        updateStars() {
                //TODO method stub
        }
}

/*
 The code below contains utility functions for common WebGL features.
 It is from the GitHub repository
 https://github.com/mapbox/webgl-wind
 and is licensed under the
 
 ISC License
 
 Copyright (c) 2016, Mapbox
 
 Permission to use, copy, modify, and/or distribute this software for any purpose
 with or without fee is hereby granted, provided that the above copyright notice
 and this permission notice appear in all copies.
 
 THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
 FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
 OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
 TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
 THIS SOFTWARE.
*/

function createShader(gl, type, source) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                throw new Error(gl.getShaderInfoLog(shader));
        }
        
        return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
        var program = gl.createProgram();
        
        var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
        var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
        
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                throw new Error(gl.getProgramInfoLog(program));
        }
        
        var wrapper = {program: program};
        
        var numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
        for (var i = 0; i < numAttributes; i++) {
                var attribute = gl.getActiveAttrib(program, i);
                wrapper[attribute.name] = gl.getAttribLocation(program, attribute.name);
        }
        var numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (var i$1 = 0; i$1 < numUniforms; i$1++) {
                var uniform = gl.getActiveUniform(program, i$1);
                wrapper[uniform.name] = gl.getUniformLocation(program, uniform.name);
        }
        
        return wrapper;
}

function createTexture(gl, filter, data, width, height) {
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        if (data instanceof Uint8Array) {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        } else {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
}

function bindTexture(gl, texture, unit) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
}

function createBuffer(gl, data) {
        var buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        return buffer;
}

function bindAttribute(gl, buffer, attribute, numComponents) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, numComponents, gl.FLOAT, false, 0, 0);
}

function bindFramebuffer(gl, framebuffer, texture) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        if (texture) {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        }
}
