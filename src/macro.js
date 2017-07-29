const MIN_GALAXIES = 1;
const MAX_GALAXIES = 1;
const MIN_STARS_IN_GALAXY = 1000;
const MAX_STARS_IN_GALAXY = 1000;

const INITIAL_BOUNDS = 500.0;
const INITIAL_SPEED_LIMIT = 1.0;
const BLACK_HOLE_GRAVITY = 1.0;

function randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
        return Math.random() * (max - min) + min;
}

class BlackHole {
        constructor() {
                this.pos = vec3.random(vec3.create(), INITIAL_BOUNDS);
                this.vel = vec3.random(vec3.create(), INITIAL_SPEED_LIMIT);
        }
}

class Universe {
        constructor(gl) {
                this.gl = gl;
                this.quadBuffer = createBuffer(gl, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));
                this.framebuffer = gl.createFramebuffer();
                
                this.starCount = 0;
                this.blackHoles = [];
                this.genesis();
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
                var starPositions =  new Uint8Array(this.starCount * 4);
                var starVelocities = new Uint8Array(this.starCount * 4);
                var arrayOffset = 0;
                var galaxyRadius;
                var starDist, starAngle;
                var starPosX, starPosY, starPosZ;
                var starSpeed;
                var starVelX, starVelY, starVelZ;
                for (var i = 0; i < galaxyCount; i++) {
                        this.blackHoles[i] = new BlackHole();
                        
                        //generate stars
                        galaxyRadius = galaxySizes[i] * 0.05; //TODO
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
                                
                                starPositions[arrayOffset]     = Math.floor(starPosX * 0xFF);
                                starPositions[arrayOffset + 1] = Math.floor(starPosY * 0xFF);
                                starPositions[arrayOffset + 2] = Math.floor(starPosZ * 0xFF);
                                starPositions[arrayOffset + 3] = 0xFF;
                                starVelocities[arrayOffset]     = Math.floor(starVelX * 0xFF);
                                starVelocities[arrayOffset + 1] = Math.floor(starVelY * 0xFF);
                                starVelocities[arrayOffset + 2] = Math.floor(starVelZ * 0xFF);
                                starVelocities[arrayOffset + 3] = 0xFF;
                                arrayOffset += 4;
                        }
                }
                
                //store star states in textures
                var gl = this.gl;
                this.starPosTexture = createTexture(gl, gl.NEAREST, starPositions,  this.starCount, 1);
                this.starVelTexture = createTexture(gl, gl.NEAREST, starVelocities, this.starCount, 1);
                
                //store star indices in buffer
                var starIndices = new Float32Array(this.starCount);
                for (var i = 0; i < this.starCount; i++) {
                        starIndices[i] = i;
                }
                this.starIndexBuffer = createBuffer(gl, starIndices);
        }
        
        nextFrame() {
                const gl = this.gl;
                gl.enable(gl.DEPTH_TEST);
                gl.depthFunc(gl.LESS);
                gl.disable(gl.STENCIL_TEST);
                
                this.draw();
                this.update();
        }
        
        draw() {
                this.drawStars();
        }
        
        drawStars() {
                //TODO method stub
        }
        
        update() {
                this.updateBlackHoles();
                this.updateStars();
        }
        
        updateBlackHoles() {
                var acc;
                for (var i = 0; i < this.blackHoles.length; i++) {
                        for (var j = i + 1; j < this.blackHoles.length; i++) {
                                acc = vec3.create();
                                vec3.sub(acc, this.blackHoles[i].pos, this.blackHoles[j].pos);
                                vec3.scale(acc, BLACK_HOLE_GRAVITY /
                                        (length(acc) * squaredLength(acc)));
                                vec3.add(this.blackHoles[j].vel, this.blackHoles[j].vel, acc);
                                vec3.sub(this.blackHoles[i].vel, this.blackHoles[i].vel, acc);
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
