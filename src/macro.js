const DEFAULT_GALAXIES = 2;
const DEFAULT_STARS_PER_GALAXY = 500000;
const DEFAULT_GALAXY_RADIUS = 150.0;
const DEFAULT_BOUNDS = 500.0;
const DEFAULT_MAX_SPEED = 2.0;
const DEFAULT_CAM_POS = vec3.fromValues(0.0, 0.0, DEFAULT_BOUNDS * 2.0);

const BLACK_HOLE_GRAVITY = 5000.0;

const BH_VERT = '\
#version 300 es\n\
\n\
uniform mat4 u_mvp_matrix;\n\
\n\
in vec3 a_pos;\n\
\n\
void main() {\n\
        gl_Position = u_mvp_matrix * vec4(a_pos, 1.0);\n\
        gl_PointSize = 10000.0 / gl_Position.z;\n\
}\n\
';

const BH_FRAG = '\
#version 300 es\n\
\n\
precision mediump float;\n\
\n\
out vec4 fragColor;\n\
\n\
void main() {\n\
        fragColor = vec4(1.0, 0.0, 1.0, 1.0);\n\
}\n\
';

const STAR_VERT = '\
#version 300 es\n\
\n\
precision mediump float;\n\
\n\
uniform mat4 u_mvp_matrix;\n\
uniform sampler2D u_star_pos;\n\
uniform float u_star_res;\n\
\n\
in float a_index;\n\
\n\
vec4 getTexelColor(float index) {\n\
        return texture(u_star_pos, vec2(\n\
                fract(index / u_star_res),\n\
                floor(index / u_star_res) / u_star_res));\n\
}\n\
\n\
void main() {\n\
        vec4 posColor = texture(u_star_pos, vec2(\n\
                fract(a_index / u_star_res),\n\
                floor(a_index / u_star_res) / u_star_res));\n\
        gl_Position = u_mvp_matrix * vec4(posColor.xyz, 1.0);\n\
        gl_PointSize = 1000.0 / gl_Position.z;\n\
}\n\
';

const STAR_FRAG = '\
#version 300 es\n\
\n\
precision mediump float;\n\
\n\
uniform vec4 u_color;\n\
\n\
out vec4 fragColor;\n\
\n\
void main() {\n\
        fragColor = u_color;\n\
}\n\
';

const QUAD_VERT = '\
#version 300 es\n\
\n\
precision mediump float;\n\
\n\
in vec2 a_pos;\n\
in vec2 a_tex_pos;\n\
\n\
out vec2 v_tex_pos;\n\
\n\
void main() {\n\
        v_tex_pos = a_tex_pos;\n\
        gl_Position = vec4(a_pos, 0, 1);\n\
}\n\
';

const STAR_UPDATE_FRAG = '\
#version 300 es\n\
\n\
precision mediump float;\n\
\n\
uniform float u_bh_gravity;\n\
uniform sampler2D u_star_pos;\n\
uniform sampler2D u_star_vel;\n\
#define BH_COUNT bh_count_to_replace\n\
uniform vec3 u_bh_pos[BH_COUNT];\n\
\n\
in vec2 v_tex_pos;\n\
\n\
layout(location=0) out vec4 new_star_pos;\n\
layout(location=1) out vec4 new_star_vel;\n\
\n\
vec3 gAcc(vec3 starPos, vec3 bhPos) {\n\
        vec3 dist = bhPos - starPos;\n\
        return normalize(dist) * u_bh_gravity / dot(dist, dist);\n\
}\n\
\n\
void main() {\n\
        vec3 pos = texture(u_star_pos, v_tex_pos).xyz;\n\
        vec3 vel = texture(u_star_vel, v_tex_pos).xyz;\n\
        vec3 acc = vec3(0.0);\n\
        for (int i = 0; i < BH_COUNT; i++) {\n\
                acc += gAcc(pos, u_bh_pos[i]);\n\
        }\n\
        vec3 newVel = vel + acc;\n\
        new_star_pos = vec4(pos + newVel, 0.0);\n\
        new_star_vel = vec4(newVel, 0.0);\n\
}\n\
';

function randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
        return Math.random() * (max - min) + min;
}

class BlackHole {
        constructor(bounds, maxSpeed) {
                this.pos = vec3.fromValues(
                        randFloat(-bounds, bounds),
                        randFloat(-bounds, bounds),
                        randFloat(-bounds, bounds));
                this.vel = vec3.fromValues(
                        randFloat(-maxSpeed, maxSpeed),
                        randFloat(-maxSpeed, maxSpeed),
                        randFloat(-maxSpeed, maxSpeed));
        }
}

class Universe {
        constructor(gl, options) {
                this.gl = gl;
                console.assert(gl.getExtension('EXT_color_buffer_float'));
                
                this.setOption(options, 'lightMode', false, 'boolean');
                this.setOption(options, 'galaxies', DEFAULT_GALAXIES, 'number');
                this.setOption(options, 'starsPerGalaxy', DEFAULT_STARS_PER_GALAXY, 'number');
                this.setOption(options, 'galaxyRadius', DEFAULT_GALAXY_RADIUS, 'number');
                this.setOption(options, 'bounds', DEFAULT_BOUNDS, 'number');
                this.setOption(options, 'maxSpeed', DEFAULT_MAX_SPEED, 'number');
                this.setOption(options, 'camPos', DEFAULT_CAM_POS);
                this.camPos = vec3.fromValues(this.camPos[0], this.camPos[1], this.camPos[2]);
                this.starCount = this.galaxies * this.starsPerGalaxy;
                
                this.modelMatrix = mat4.identity(mat4.create());
                this.viewMatrix = mat4.lookAt(mat4.create(),
                        this.camPos,
                        vec3.fromValues(0.0, 0.0, 0.0),
                        vec3.fromValues(0.0, 1.0, 0.0));
                this.projectionMatrix = mat4.perspective(mat4.create(),
                        Math.PI / 3.0, gl.canvas.width / gl.canvas.height, 1.0, 10000.0);
                
                this.mvpMatrix = mat4.create();
                this.updateMvpMatrix();
                this.genesis();
                
                this.blackHoleShaderProgram = createProgram(gl, BH_VERT, BH_FRAG);
                this.starShaderProgram = createProgram(gl, STAR_VERT, STAR_FRAG);
                this.starUpdateShaderProgram = createProgram(gl, QUAD_VERT,
                        STAR_UPDATE_FRAG.replace(/bh_count_to_replace/, this.blackHoles.length));
                this.starUpdateShaderProgram.u_bh_pos = gl.getUniformLocation(
                        this.starUpdateShaderProgram.program, 'u_bh_pos[0]');
                
                this.blackHolePositions = new Float32Array(this.blackHoles.length * 3);
                this.blackHolePosBuffer = gl.createBuffer();
                
                this.starStateBuf = gl.createFramebuffer();
                this.updateFramebufferAttachments();
                
                this.quadPosBuffer = createBuffer(gl, new Float32Array(
                        [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]));
                this.quadTexPosBuffer = createBuffer(gl, new Float32Array(
                        [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));
                this.quadVAO = gl.createVertexArray();
                gl.bindVertexArray(this.quadVAO);
                bindAttribute(gl, this.quadPosBuffer, this.starUpdateShaderProgram.a_pos, 2);
                bindAttribute(gl, this.quadTexPosBuffer, this.starUpdateShaderProgram.a_tex_pos, 2);
                gl.bindVertexArray(null);
        }
        
        setOption(options, property, defaultValue, type) {
                this[property] = (options &&
                        ((typeof(type) === 'undefined') ?
                                (typeof(options[property]) !== 'undefined') :
                                (typeof(options[property]) === type))) ?
                                        options[property] : defaultValue;
        }
        
        genesis() {
                //allocate star position and velocity buffers
                
                this.starStateTextureRes = Math.ceil(Math.sqrt(this.starCount));
                
                this.starTexelCount =
                        this.starStateTextureRes * this.starStateTextureRes;
                console.log('using ' + this.starStateTextureRes + 'x' +
                        this.starStateTextureRes + ' texture for ' +
                        this.starCount + ' stars (' + this.starTexelCount +
                        ' texels)');
                var starPosBuf = new Float32Array(this.starTexelCount * 4);
                var starVelBuf = new Float32Array(this.starTexelCount * 4);
                
                //generate black holes
                this.blackHoles = [];
                var arrayOffset = 0;
                var starDist, starAngle;
                var starPosX, starPosY, starPosZ;
                var starSpeed;
                var starVelX, starVelY, starVelZ;
                for (var i = 0; i < this.galaxies; i++) {
                        this.blackHoles[i] = new BlackHole(this.bounds, this.maxSpeed);
                        
                        //generate stars
                        for (var j = 0; j < this.starsPerGalaxy; j++) {
                                starDist = randFloat(0, this.galaxyRadius);
                                starAngle = randFloat(0, 2.0 * Math.PI);
                                starPosX = starDist * Math.cos(starAngle);
                                starPosY = starDist * Math.sin(starAngle);
                                starPosZ = 0.0;
                                starSpeed = Math.sqrt(BLACK_HOLE_GRAVITY / starDist);
                                starVelX = starSpeed * -Math.sin(starAngle);
                                starVelY = starSpeed *  Math.cos(starAngle);
                                starVelZ = 0.0;
                                
                                starPosBuf[arrayOffset]     = this.blackHoles[i].pos[0] + starPosX;
                                starPosBuf[arrayOffset + 1] = this.blackHoles[i].pos[1] + starPosY;
                                starPosBuf[arrayOffset + 2] = this.blackHoles[i].pos[2] + starPosZ;
                                
                                starVelBuf[arrayOffset]     = this.blackHoles[i].vel[0] + starVelX;
                                starVelBuf[arrayOffset + 1] = this.blackHoles[i].vel[1] + starVelY;
                                starVelBuf[arrayOffset + 2] = this.blackHoles[i].vel[2] + starVelZ;
                                
                                arrayOffset += 4;
                        }
                }
                
                //store star states in textures
                const gl = this.gl;
                this.starPosTexture0 = createTexture(gl, gl.NEAREST, starPosBuf,
                        this.starStateTextureRes, this.starStateTextureRes);
                this.starVelTexture0 = createTexture(gl, gl.NEAREST, starVelBuf,
                        this.starStateTextureRes, this.starStateTextureRes);
                //create empty textures to write new star states into
                this.starPosTexture1 = createEmptyTexture(gl, gl.NEAREST, gl.RGBA32F,
                        this.starStateTextureRes, this.starStateTextureRes);
                this.starVelTexture1 = createEmptyTexture(gl, gl.NEAREST, gl.RGBA32F,
                        this.starStateTextureRes, this.starStateTextureRes,
                        gl.RGBA32F);
                
                //store star indices in buffer
                var starIndices = new Float32Array(this.starCount);
                for (var i = 0; i < this.starCount; i++) {
                        starIndices[i] = i;
                }
                this.starIndexBuffer = createBuffer(gl, starIndices);
                
                console.log('created ' + this.galaxies + ' galaxies and ' +
                        this.starCount + ' stars');
        }
        
        moveCamera(camPos) {
                this.camPos = vec3.fromValues(camPos[0], camPos[1], camPos[2]);
                mat4.lookAt(this.viewMatrix,
                        this.camPos,
                        vec3.fromValues(0.0, 0.0, 0.0),
                        vec3.fromValues(0.0, 1.0, 0.0));
                this.updateMvpMatrix();
        }
        
        updateMvpMatrix() {
                mat4.multiply(this.mvpMatrix, this.viewMatrix, this.modelMatrix);
                mat4.multiply(this.mvpMatrix, this.projectionMatrix, this.mvpMatrix);
        }
        
        drawFrame() {
//                this.updateBlackHolePosBuffer();
                this.draw();
        }
        
        draw() {
                this.readyDraw();
//                this.drawBlackHoles();
                this.drawStars(this.starIndexBuffer);
        }
        
        readyDraw() {
                const gl = this.gl;
                gl.enable(gl.BLEND);
                this.lightMode ?
                        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA) :
                        gl.blendFunc(gl.ONE, gl.ONE);
                gl.disable(gl.STENCIL_TEST);
                
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
                this.lightMode ?
                        gl.clearColor(1, 1, 1, 1) :
                        gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        }
        
        drawLayers() {
                var numLayers = canvas2DContexts.length;
                
                var starPosBuf = new Float32Array(this.starTexelCount * 4);
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.starStateBuf);
                gl.readPixels(0, 0, this.starStateTextureRes, this.starStateTextureRes,
                        gl.RGBA, gl.FLOAT, starPosBuf);
                
                var layerStarIndices = [];
                for (var i = 0; i < numLayers; i++) {
                        layerStarIndices[i] = [];
                }
                
                var starPosIndex;
                var starPos;
                var layer;
                for (var i = 0; i < this.starCount; i++) {
                        layer = floor((starPosBuf(i * 3 + 2) + this.bounds) / (2 * this.bounds));
                        layerStarIndices[layer].push(i);
                }
                
                const gl = this.gl;
                var layerFramebuffer = gl.createFramebuffer();
                gl.bindFramebuffer(layerFramebuffer);
                var canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                var context = canvas.getContext('2d');
                var layerImages = [];
                for (var i = 0; i < numLayers; i++) {
                        var layerStarIndexBuf = Float32Array.from(layerStarIndices[i]);
                        
                        var layerTexture = createEmptyTexture(gl, gl.NEAREST, gl.RGBA32F,
                                gl.canvas.width, gl.canvas.height);
                        
                        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                                gl.TEXTURE_2D, layerTexture, 0);
                        gl.drawBuffers([gl.COLOR_ATTACHMENT0]); //TODO can do without?
                        gl.readBuffer(gl.COLOR_ATTACHMENT0); //TODO can do without?
                        
                        this.readyDraw();
                        this.drawStars(layerStarIndexBuf);
                        
                        var layerPixels = new Uint8Array(gl.canvas.width * gl.canvas.height * 3);
                        gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height,
                                gl.RGB, gl.UNSIGNED_BYTE, layerPixels);
                        
                        var imageData = context.createImageData(
                                gl.canvas.width, gl.canvas.height);
                        imageData.data.set(layerPixels);
                        context.putImageData(imageData, 0, 0);
                        
                        var img = new Image();
                        img.src = canvas.toDataURL();
                        layerImages[i] = img;
                }
                gl.deleteFramebuffer(layerFramebuffer);
        }
        
        drawBlackHoles() {
                const gl = this.gl;
                
                gl.useProgram(this.blackHoleShaderProgram.program);
                gl.uniformMatrix4fv(this.blackHoleShaderProgram.u_mvp_matrix,
                        false, this.mvpMatrix);
                
                bindAttribute(gl, this.blackHolePosBuffer,
                        this.blackHoleShaderProgram.a_pos, 3);
                gl.drawArrays(gl.POINTS, 0, this.blackHoles.length);
        }
        
        drawStars(starIndexBuf) {
                const gl = this.gl;
                gl.disable(gl.DEPTH_TEST);
                gl.useProgram(this.starShaderProgram.program);
                
                bindTexture(gl, this.starPosTexture0, 0);
                gl.uniformMatrix4fv(this.starShaderProgram.u_mvp_matrix,
                        false, this.mvpMatrix);
                gl.uniform1i(this.starShaderProgram.u_star_pos, 0);
                gl.uniform1f(this.starShaderProgram.u_star_res, this.starStateTextureRes);
                gl.uniform4fv(this.starShaderProgram.u_color,
                        this.lightMode ? [0, 0, 0, 0.02] : [0.02, 0.02, 0.02, 1]);
                
                bindAttribute(gl, starIndexBuf, this.starShaderProgram.a_index, 1);
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
                
                var arrayOffset = 0;
                for (var bh of this.blackHoles) {
                        this.blackHolePositions[arrayOffset++] = bh.pos[0];
                        this.blackHolePositions[arrayOffset++] = bh.pos[1];
                        this.blackHolePositions[arrayOffset++] = bh.pos[2];
                }
        }
        
        updateStars() {
                const gl = this.gl;
                gl.disable(gl.BLEND);
                gl.viewport(0, 0, this.starStateTextureRes, this.starStateTextureRes);
                gl.useProgram(this.starUpdateShaderProgram.program);
                
                bindTexture(gl, this.starPosTexture0, 0);
                bindTexture(gl, this.starVelTexture0, 1);
                gl.uniform1f(this.starUpdateShaderProgram.u_bh_gravity, BLACK_HOLE_GRAVITY);
                gl.uniform1i(this.starUpdateShaderProgram.u_star_pos, 0);
                gl.uniform1i(this.starUpdateShaderProgram.u_star_vel, 1);
                gl.uniform3fv(this.starUpdateShaderProgram.u_bh_pos, this.blackHolePositions);
                
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.starStateBuf);
                gl.bindVertexArray(this.quadVAO);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.bindVertexArray(null);
                
                this.swapStarStateBuffers();
        }
        
        swapStarStateBuffers() {
                var tempPos = this.starPosTexture1;
                this.starPosTexture1 = this.starPosTexture0;
                this.starPosTexture0 = tempPos;
                
                var tempVel = this.starVelTexture1;
                this.starVelTexture1 = this.starVelTexture0;
                this.starVelTexture0 = tempVel;
                
                this.updateFramebufferAttachments();
        }
        
        updateFramebufferAttachments() {
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.starStateBuf);
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                        gl.TEXTURE_2D, this.starPosTexture1, 0);
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1,
                        gl.TEXTURE_2D, this.starVelTexture1, 0);
                gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
        
        updateBlackHolePosBuffer() {
                gl.bindBuffer(gl.ARRAY_BUFFER, this.blackHolePosBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, this.blackHolePositions, gl.DYNAMIC_DRAW);
                gl.bindBuffer(gl.ARRAY_BUFFER, null);
        }
}

function createEmptyTexture(gl, filter, type, width, height) {
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        
        gl.texStorage2D(gl.TEXTURE_2D, 1, type, width, height);
        
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
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
                console.log('created Uint8 texture');
        } else if (data instanceof Float32Array) {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
                console.log('created Float32 texture');
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
