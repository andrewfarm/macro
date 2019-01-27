const DEFAULT_GALAXIES = 2;
const DEFAULT_STARS_PER_GALAXY = 500000;
const DEFAULT_GALAXY_RADIUS = 150.0;
const DEFAULT_BOUNDS = 500.0;
const DEFAULT_MAX_SPEED = 2.0;
const DEFAULT_CAM_POS = vec3.fromValues(0.0, 0.0, DEFAULT_BOUNDS * 2.0);

const BLACK_HOLE_GRAVITY = 5000.0;

const STAR_INTENSITY = 0.25;

const STAR_POS_TEXTURE_UNIT = 0;
const STAR_VEL_TEXTURE_UNIT = 1;
const STAR_2D_POS_TEXTURE_UNIT = 2;
const GALAXY_TEXTURE_UNIT = 3;
const BH_TEXTURE_UNIT = 4;
const SCREEN_TEXTURE_UNIT = 5;

const GALAXY_TEXTURE_URLS = [
        'res/spiral-galaxy.jpg',
        'res/space-spiral-galaxy-messier-101.png',
        'res/gradient-galaxy-low.png'
];
const BH_TEXTURE_URL = 'res/bh.jpg';

const BH_VERT = '\
#version 300 es\n\
\n\
uniform mat4 u_mvp_matrix;\n\
\n\
in vec3 a_pos;\n\
\n\
void main() {\n\
        gl_Position = u_mvp_matrix * vec4(a_pos, 1.0);\n\
        gl_PointSize = 70000.0 / gl_Position.z;\n\
}\n\
';

const BH_FRAG = '\
#version 300 es\n\
\n\
precision mediump float;\n\
\n\
uniform int u_frame;\n\
uniform sampler2D u_bh_texture;\n\
\n\
out vec4 fragColor;\n\
\n\
\n\
void main() {\n\
//        fragColor = vec4(1.0, 0.0, 1.0, 1.0);\n\
        vec2 frameCoord = vec2(float(u_frame % 8), float(u_frame / 8)) / 8.0;\n\
        fragColor = texture(u_bh_texture,\n\
                frameCoord + (gl_PointCoord / 8.0));\n\
        fragColor *= (1.0 - floor(length(gl_PointCoord * 2.0 - vec2(1.0, 1.0))));\n\
}\n\
';

const STAR_VERT = '\
#version 300 es\n\
\n\
precision mediump float;\n\
\n\
uniform mat4 u_mvp_matrix;\n\
uniform sampler2D u_star_pos;\n\
uniform sampler2D u_star_2D_pos;\n\
uniform sampler2D u_galaxy_texture;\n\
uniform float u_star_res;\n\
\n\
in float a_index;\n\
\n\
out vec4 v_color;\n\
\n\
vec4 getTexelColor(sampler2D sampler, float index) {\n\
        return texture(sampler, vec2(\n\
                fract(index / u_star_res),\n\
                floor(index / u_star_res) / u_star_res));\n\
}\n\
\n\
void main() {\n\
        vec4 star2DPos = getTexelColor(u_star_2D_pos, a_index);\n\
        v_color = texture(u_galaxy_texture, star2DPos.xy);\n\
//        v_color = vec4(star2DPos.x, star2DPos.y, 0.0, 1.0); //experimental\n\
        vec4 starPos = getTexelColor(u_star_pos, a_index);\n\
        gl_Position = u_mvp_matrix * vec4(starPos.xyz, 1.0);\n\
        gl_PointSize = 1000.0 / gl_Position.z;\n\
}\n\
';

const STAR_FRAG = '\
#version 300 es\n\
\n\
precision mediump float;\n\
\n\
uniform float u_intensity;\n\
\n\
in vec4 v_color;\n\
\n\
out vec4 fragColor;\n\
\n\
void main() {\n\
        fragColor = v_color * u_intensity;\n\
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

const SCREEN_FRAG = '\
#version 300 es\n\
\n\
precision mediump float;\n\
\n\
uniform sampler2D u_screen_texture;\n\
\n\
in vec2 v_tex_pos;\n\
\n\
out vec4 fragColor;\n\
\n\
void main() {\n\
        fragColor = texture(u_screen_texture, v_tex_pos) * vec4(0.3, 0.0, 1.0, 1.0);\n\
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
                this.setOption(options, 'bhVisible', false, 'boolean');
                this.setOption(options, 'galaxies', DEFAULT_GALAXIES, 'number');
                this.setOption(options, 'starsPerGalaxy', DEFAULT_STARS_PER_GALAXY, 'number');
                this.setOption(options, 'galaxyRadius', DEFAULT_GALAXY_RADIUS, 'number');
                this.setOption(options, 'bounds', DEFAULT_BOUNDS, 'number');
                this.setOption(options, 'maxSpeed', DEFAULT_MAX_SPEED, 'number');
                this.starCount = this.galaxies * this.starsPerGalaxy;
                
//                this.modelMatrix = mat4.identity(mat4.create());
                this.viewRotationMatrix = mat4.identity(mat4.create());
                this.viewTranslationMatrix = mat4.lookAt(mat4.create(),
                        DEFAULT_CAM_POS,
                        vec3.fromValues(0.0, 0.0, 0.0),
                        vec3.fromValues(0.0, 1.0, 0.0));
                this.projectionMatrix = mat4.perspective(mat4.create(),
                        Math.PI / 3.0, gl.canvas.width / gl.canvas.height, 1.0, 10000.0);
                
                this.mvpMatrix = mat4.create();
                this.updateMvpMatrix();
                this.genesis();
                
                // load galaxy texture
                var galaxyTexture = createTexture(gl, gl.NEAREST,
                        new Uint8Array([255, 255, 255, 255]), 1, 1);
                const galaxyImage = new Image();
                galaxyImage.onload = function() {
                        gl.bindTexture(gl.TEXTURE_2D, galaxyTexture);
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, galaxyImage);
                        gl.bindTexture(gl.TEXTURE_2D, null);
                        console.log('galaxy texture loaded (' +
                                galaxyImage.width + 'x' + galaxyImage.height + ')');
                };
                this.galaxyTexture = galaxyTexture;
                galaxyImage.src = GALAXY_TEXTURE_URLS[Math.floor(Math.random() * GALAXY_TEXTURE_URLS.length)];
                
                // load black hole texture
                var bhTexture = createTexture(gl, gl.LINEAR,
                        new Uint8Array([0, 0, 0, 255]), 1, 1);
                const bhImage = new Image();
                bhImage.onload = function() {
                        gl.bindTexture(gl.TEXTURE_2D, bhTexture);
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bhImage);
                        gl.bindTexture(gl.TEXTURE_2D, null);
                        console.log('black hole texture loaded (' +
                                    bhImage.width + 'x' + bhImage.height + ')');
                };
                this.bhTexture = bhTexture;
                bhImage.src = BH_TEXTURE_URL;
                this.bhAnimStart = Date.now();
                
                this.blackHoleShaderProgram = createProgram(gl, BH_VERT, BH_FRAG);
                this.starShaderProgram = createProgram(gl, STAR_VERT, STAR_FRAG);
                this.starUpdateShaderProgram = createProgram(gl, QUAD_VERT,
                        STAR_UPDATE_FRAG.replace(/bh_count_to_replace/, this.blackHoles.length));
                this.starUpdateShaderProgram.u_bh_pos = gl.getUniformLocation(
                        this.starUpdateShaderProgram.program, 'u_bh_pos[0]');
                this.screenShaderProgram = createProgram(gl, QUAD_VERT, SCREEN_FRAG);
                
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
            
                this.screenTexture = gl.createTexture();
                this.displayResized();
                gl.bindTexture(gl.TEXTURE_2D, this.screenTexture);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            
                this.screenBuf = gl.createFramebuffer();
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.screenBuf);
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                        gl.TEXTURE_2D, this.screenTexture, 0);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
    
        displayResized() {
                // set size of screen framebuffer texture
                gl.bindTexture(gl.TEXTURE_2D, this.screenTexture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.canvas.width, gl.canvas.height, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
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
                const starPosBuf = new Float32Array(this.starTexelCount * 4);
                const starVelBuf = new Float32Array(this.starTexelCount * 4);
                const star2DPosBuf = new Float32Array(this.starTexelCount * 4);
                
                //generate black holes
                this.blackHoles = [];
                var arrayOffset = 0;
                var starDistFraction, starDist, starAngle;
                var starPos = vec4.create();
                var starSpeed;
                var starVel = vec4.create();
                var galaxyRotationMatrix = mat4.create();
                for (var i = 0; i < this.galaxies; i++) {
                        this.blackHoles[i] = new BlackHole(this.bounds, this.maxSpeed);
                        
                        //randomize galaxy orientation
                        mat4.identity(galaxyRotationMatrix);
                        mat4.rotateX(galaxyRotationMatrix, galaxyRotationMatrix,
                                randFloat(0, 2.0 * Math.PI));
                        mat4.rotateY(galaxyRotationMatrix, galaxyRotationMatrix,
                                randFloat(0, 2.0 * Math.PI));
                        mat4.rotateZ(galaxyRotationMatrix, galaxyRotationMatrix,
                                randFloat(0, 2.0 * Math.PI));
                        
                        //generate stars
                        for (var j = 0; j < this.starsPerGalaxy; j++) {
                                starDistFraction = randFloat(0.15, 1.0);
                                starDist = starDistFraction * this.galaxyRadius;
                                starAngle = randFloat(0, 2.0 * Math.PI);
                                vec4.set(starPos,
                                        starDistFraction * Math.cos(starAngle),
                                        starDistFraction * Math.sin(starAngle),
                                        0.0,
                                        0.0);
                                starSpeed = Math.sqrt(BLACK_HOLE_GRAVITY / starDist);
                                vec4.set(starVel,
                                        starSpeed * -Math.sin(starAngle),
                                        starSpeed *  Math.cos(starAngle),
                                        0.0,
                                        0.0);
                                
                                star2DPosBuf[arrayOffset]     = (starPos[0] + 1.0) / 2;
                                star2DPosBuf[arrayOffset + 1] = (starPos[1] + 1.0) / 2;
                                
                                vec4.scale(starPos, starPos, this.galaxyRadius);
                                
                                vec4.transformMat4(starPos, starPos, galaxyRotationMatrix);
                                vec4.transformMat4(starVel, starVel, galaxyRotationMatrix);
                                
                                starPosBuf[arrayOffset]     = this.blackHoles[i].pos[0] + starPos[0];
                                starPosBuf[arrayOffset + 1] = this.blackHoles[i].pos[1] + starPos[1];
                                starPosBuf[arrayOffset + 2] = this.blackHoles[i].pos[2] + starPos[2];
                                
                                starVelBuf[arrayOffset]     = this.blackHoles[i].vel[0] + starVel[0];
                                starVelBuf[arrayOffset + 1] = this.blackHoles[i].vel[1] + starVel[1];
                                starVelBuf[arrayOffset + 2] = this.blackHoles[i].vel[2] + starVel[2];
                                
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
                //store 2D initial positions of stars (for texturing) in texture
                this.star2DPosTexture = createTexture(gl, gl.NEAREST, star2DPosBuf,
                        this.starStateTextureRes, this.starStateTextureRes);
                
                //store star indices in buffer
                var starIndices = new Float32Array(this.starCount);
                for (var i = 0; i < this.starCount; i++) {
                        starIndices[i] = i;
                }
                this.starIndexBuffer = createBuffer(gl, starIndices);
                
                console.log('created ' + this.galaxies + ' galaxies and ' +
                        this.starCount + ' stars');
        }
        
        rotateView(angleX, angleY) {
                mat4.multiply(this.viewRotationMatrix, mat4.fromYRotation(mat4.create(), angleX), this.viewRotationMatrix);
                mat4.multiply(this.viewRotationMatrix, mat4.fromXRotation(mat4.create(), angleY), this.viewRotationMatrix);
//                mat4.rotateY(this.viewRotationMatrix, this.viewRotationMatrix, angleX);
//                mat4.rotateX(this.viewRotationMatrix, this.viewRotationMatrix, angleY);
                this.updateMvpMatrix();
        }
        
        updateMvpMatrix() {
//                mat4.multiply(this.mvpMatrix, this.viewMatrix, this.modelMatrix);
//                mat4.multiply(this.mvpMatrix, this.projectionMatrix, this.mvpMatrix);
                mat4.multiply(this.mvpMatrix, this.viewTranslationMatrix, this.viewRotationMatrix);
                mat4.multiply(this.mvpMatrix, this.projectionMatrix, this.mvpMatrix);
        }
        
        drawFrame() {
                if (this.bhVisible) {
                        this.updateBlackHolePosBuffer();
                }
                this.draw();
        }
        
        draw() {
                this.readyDraw(this.screenBuf);
                if (this.bhVisible) {
                        this.drawBlackHoles();
                }
                this.drawStars(this.starIndexBuffer, this.starCount);
            
                // do postprocessing & render to screen
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.disable(gl.DEPTH_TEST);
                gl.useProgram(this.screenShaderProgram.program);
                bindTexture(gl, this.screenTexture, SCREEN_TEXTURE_UNIT);
                gl.uniform1i(this.screenShaderProgram.u_screen_texture, SCREEN_TEXTURE_UNIT);
                gl.bindVertexArray(this.quadVAO);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        
        readyDraw(framebuffer) {
                const gl = this.gl;
                gl.enable(gl.BLEND);
//                gl.disable(gl.BLEND); //experimental
//                gl.enable(gl.DEPTH_TEST); //experimental
//                gl.depthFunc(gl.LESS); //experimental
//                gl.clear(gl.DEPTH_BUFFER_BIT); //experimental
                this.lightMode ?
                        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA) :
                        gl.blendFunc(gl.ONE, gl.ONE);
                gl.disable(gl.STENCIL_TEST);
                
                gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
                gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
                this.lightMode ?
                        gl.clearColor(1, 1, 1, 1) :
                        gl.clearColor(0, 0, 0, 1);
                gl.clear(gl.COLOR_BUFFER_BIT);
        }
        
        drawLayers(numLayers) {
                const gl = this.gl;
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
                        layer = Math.min(Math.max(Math.floor(
                                (starPosBuf[i * 4 + 2] + this.bounds) / (2 * this.bounds) * numLayers),
                                0), numLayers - 1);
                        layerStarIndices[layer].push(i);
                }
                
                var layerFramebuffer = gl.createFramebuffer();
                var canvas = document.createElement('canvas');
                canvas.width = gl.canvas.width;
                canvas.height = gl.canvas.height;
                var context = canvas.getContext('2d');
                var layerImages = [];
                for (var i = 0; i < numLayers; i++) {
                        var layerTexture = createEmptyTexture(gl, gl.NEAREST, gl.RGBA8,
                                gl.canvas.width, gl.canvas.height);
                        
                        gl.bindFramebuffer(gl.FRAMEBUFFER, layerFramebuffer);
                        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                                gl.TEXTURE_2D, layerTexture, 0);
                        
                        var layerStarIndexBuf = createBuffer(
                                gl, Float32Array.from(layerStarIndices[i]));
                        
                        this.readyDraw(layerFramebuffer);
                        this.drawStars(layerStarIndexBuf, layerStarIndices[i].length);
                        
                        var layerPixels = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);
                        gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height,
                                gl.RGBA, gl.UNSIGNED_BYTE, layerPixels);
                        
                        var imageData = context.createImageData(
                                gl.canvas.width, gl.canvas.height);
                        imageData.data.set(layerPixels);
                        context.putImageData(imageData, 0, 0);
                        
                        var img = new Image();
                        img.src = canvas.toDataURL();
                        layerImages[i] = img;
                        
                        gl.deleteTexture(layerTexture);
                        gl.deleteBuffer(layerStarIndexBuf);
                }
                gl.deleteFramebuffer(layerFramebuffer);
                
                return layerImages;
        }
        
        drawBlackHoles() {
                const gl = this.gl;
                
                gl.useProgram(this.blackHoleShaderProgram.program);
                gl.uniformMatrix4fv(this.blackHoleShaderProgram.u_mvp_matrix,
                        false, this.mvpMatrix);
                gl.uniform1i(this.blackHoleShaderProgram.u_frame,
                        Math.floor((Date.now() - this.bhAnimStart) / 20) % 60);
                bindTexture(gl, this.bhTexture, BH_TEXTURE_UNIT);
                gl.uniform1i(this.blackHoleShaderProgram.u_bh_texture, BH_TEXTURE_UNIT);
                
                bindAttribute(gl, this.blackHolePosBuffer,
                        this.blackHoleShaderProgram.a_pos, 3);
                gl.drawArrays(gl.POINTS, 0, this.blackHoles.length);
        }
        
        drawStars(starIndexBuf, numStars) {
                const gl = this.gl;
                gl.disable(gl.DEPTH_TEST);
//                gl.enable(gl.DEPTH_TEST); //experimental
                gl.useProgram(this.starShaderProgram.program);
                
                bindTexture(gl, this.starPosTexture0, STAR_POS_TEXTURE_UNIT);
                gl.uniformMatrix4fv(this.starShaderProgram.u_mvp_matrix,
                        false, this.mvpMatrix);
                gl.uniform1i(this.starShaderProgram.u_star_pos, STAR_POS_TEXTURE_UNIT);
                gl.uniform1f(this.starShaderProgram.u_star_res, this.starStateTextureRes);
//                gl.uniform4fv(this.starShaderProgram.u_color,
//                        this.lightMode ? [0, 0, 0, STAR_INTENSITY] :
//                              [STAR_INTENSITY, STAR_INTENSITY, STAR_INTENSITY, 1]);
                bindTexture(gl, this.star2DPosTexture, STAR_2D_POS_TEXTURE_UNIT);
                gl.uniform1i(this.starShaderProgram.u_star_2D_pos, STAR_2D_POS_TEXTURE_UNIT);
                bindTexture(gl, this.galaxyTexture, GALAXY_TEXTURE_UNIT);
                gl.uniform1i(this.starShaderProgram.u_galaxy_texture, GALAXY_TEXTURE_UNIT);
                gl.uniform1f(this.starShaderProgram.u_intensity, STAR_INTENSITY);
                
                bindAttribute(gl, starIndexBuf, this.starShaderProgram.a_index, 1);
                gl.drawArrays(gl.POINTS, 0, numStars);
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
                
                bindTexture(gl, this.starPosTexture0, STAR_POS_TEXTURE_UNIT);
                bindTexture(gl, this.starVelTexture0, STAR_VEL_TEXTURE_UNIT);
                gl.uniform1f(this.starUpdateShaderProgram.u_bh_gravity, BLACK_HOLE_GRAVITY);
                gl.uniform1i(this.starUpdateShaderProgram.u_star_pos, STAR_POS_TEXTURE_UNIT);
                gl.uniform1i(this.starUpdateShaderProgram.u_star_vel, STAR_VEL_TEXTURE_UNIT);
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

//This function has been modified from its original form.
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
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
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
