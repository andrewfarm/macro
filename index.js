const MOUSE_SENSITITVITY = 0.005;

var canvas = document.getElementById('canvas');
var info = document.getElementById('info');

var gui;
var resetter;

var mouseDown = false;
var mouseLastX, mouseLastY;

var options = {
    autoReset: false,
    resetInterval: 15
};
var autoResetTimer;

const gl = canvas.getContext('webgl2');
if (gl) {
        //const pixelRatio = window.devicePixelRatio || 1;
        //console.log('window.devicePixelRatio', window.devicePixelRatio);
        canvas.style.width = window.innerWidth;
        canvas.style.height = window.innerHeight;
        canvas.width = window.innerWidth;// * pixelRatio;
        canvas.height = window.innerHeight;// * pixelRatio;
        var rect = canvas.getBoundingClientRect();
    
        function updateFontColor() {
                info.style.color = universe.lightMode ? '#000000' : '#ffffff';
        }
    
        resetter = {reset: reset};
    
        function createControls(universe) {
                gui = new dat.GUI();
                gui.add(universe, 'galaxies').min(1).step(1).onFinishChange(reset);
                gui.add(universe, 'starsPerGalaxy', 1e5, 1e7).onFinishChange(reset);
                gui.add(universe, 'galaxyRadius', 50, 200).onFinishChange(reset);
                gui.add(universe, 'lightMode').onFinishChange(updateFontColor);
                gui.add(universe, 'bhVisible');
                function restartAutoReset() {
                        clearTimeout(autoResetTimer);
                        if (options.autoReset) {
                                startAutoReset();
                        }
                }
                gui.add(options, 'autoReset').onFinishChange(restartAutoReset);
                gui.add(options, 'resetInterval', 5, 30).onFinishChange(restartAutoReset);
                var resetControl = gui.add(resetter, 'reset');
        }
        
        var shouldContinue = true;
        var playing;
        var universe = new Universe(gl);
        updateFontColor();
        createControls(universe);
    
        function reset() {
                universe = new Universe(gl, universe);
                gui.destroy();
                createControls(universe);
                clearTimeout(autoResetTimer);
                if (options.autoReset) {
                        startAutoReset();
                }
        }

        function startAutoReset() {
                autoResetTimer = setTimeout(function() {
                        if (options.autoReset) {
                                reset(); // calls startAutoReset()
                        }
                }, options.resetInterval * 1000);
        }
        
        function captureLayers(numLayers) {
                var layerImages = universe.drawLayers(numLayers);
//                console.log('layerImages', layerImages);
                playing = false;
                var newWindow = window.open();
                newWindow.document.body.style.margin = '0';
                for (var i = 0; i < numLayers; i++) {
                        layerImages[i].style.border = '5px solid #ff00ff';
                        newWindow.document.body.appendChild(layerImages[i]);
                }
        }
    
        canvas.addEventListener('mousedown', function(event) {
            mouseDown = true;
            mouseLastX = event.clientX;
            mouseLastY = event.clientY;
        });
        canvas.addEventListener('mouseup', function(event) { mouseDown = false; });
        canvas.addEventListener('mousemove',
                function(event) {
                        if (mouseDown) {
                                universe.rotateView(
                                        (event.clientX - mouseLastX) * MOUSE_SENSITITVITY,
                                        (event.clientY - mouseLastY) * MOUSE_SENSITITVITY);
                                mouseLastX = event.clientX;
                                mouseLastY = event.clientY;
                        }
                });
        document.addEventListener('keypress',
                function(event) {
//                        console.log('event.which', event.which);
                        if (event.which === 13) { // enter
                                reset();
                        } else if (event.which == 32) { // space
                                playing = !playing;
                        } else if (event.which == 96) { // tilde
                                captureLayers(32);
                        }
                });

        function render() {
                universe.drawFrame();
                if (playing) {
                        universe.update();
                }
                if (shouldContinue) {
                        requestAnimationFrame(render);
                }
        }
        playing = true;
        if (options.autoReset) {
                startAutoReset();
        }
        requestAnimationFrame(render);
} else {
        document.body.innerHTML =
                '<div class="errmsg">\
                        <h1 class="red">Critical Failure</h1>\
                        <p>WebGL 2 missing from browser<p>\
                        <h2 class="green">2 solutions found</h2>\
                        <ul>\
                                <li><a href="http://firefox.com">Use Firefox &raquo;</a></li>\
                                <li><a href="http://chrome.com">Use Chrome &raquo;</a></li>\
                        </ul>\
                </div>';
}
