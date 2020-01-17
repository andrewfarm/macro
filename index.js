const MOUSE_SENSITITVITY = 0.005;

var canvas = document.getElementById('canvas');
var info = document.getElementById('info');

var gui;
var restarter;

var mouseDown = false;
var mouseLastX, mouseLastY;

var options = {
    autoRestart: false,
    restartInterval: 15
};
var autoRestartTimer;

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
    
        restarter = {restart: restart};
    
        function createControls(universe) {
                gui = new dat.GUI();
                gui.add(universe, 'galaxies').min(1).step(1).onFinishChange(restart);
                gui.add(universe, 'starsPerGalaxy', 1e5, 1e7).onFinishChange(restart);
                gui.add(universe, 'galaxyRadius', 50, 200).onFinishChange(restart);
                gui.add(universe, 'speed', 0.1, 2.5)
                gui.add(universe, 'lightMode').onFinishChange(updateFontColor);
                gui.add(universe, 'hdr');
                gui.add(universe, 'hdrExposure', 0.1, 5);
                gui.add(universe, 'starSize', 100, 5000);
                gui.add(universe, 'starIntensity', 0.05, 0.5);
                gui.add(universe, 'showBlackHoles');
                gui.add(universe, 'recenter');
                gui.add(universe, 'autocenter');
                gui.add(options, 'autoRestart').onFinishChange(restartAutoRestartTimer);
                gui.add(options, 'restartInterval', 5, 30).onFinishChange(restartAutoRestartTimer);
                gui.add(restarter, 'restart');
        }
        
        var shouldContinue = true;
        var playing;
        var universe = new Universe(gl);
        updateFontColor();
        createControls(universe);
    
        var stats = new Stats();
        stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
        document.body.appendChild(stats.dom);
    
        function restart() {
                universe = new Universe(gl, universe);
                gui.destroy();
                createControls(universe);
                clearTimeout(autoRestartTimer);
                if (options.autoRestart) {
                        startAutoRestartTimer();
                }
        }

        function startAutoRestartTimer() {
                autoRestartTimer = setTimeout(function() {
                        if (options.autoRestart) {
                                restart(); // calls startAutoRestartTimer()
                        }
                }, options.restartInterval * 1000);
        }
        
        function restartAutoRestartTimer() {
                clearTimeout(autoRestartTimer);
                if (options.autoRestart) {
                        startAutoRestartTimer();
                }
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
        document.addEventListener('mouseup', function(event) { mouseDown = false; });
        document.addEventListener('mousemove',
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
                                restart();
                        } else if (event.which == 32) { // space
                                playing = !playing;
                        } else if (event.which == 96) { // tilde
//                                captureLayers(32);
                        }
                });
        window.addEventListener('resize', function(event) { universe.displayResized(); });

        function render() {
                stats.begin();
                universe.drawFrame();
                if (playing) {
                        universe.update();
                }
                stats.end();
                if (shouldContinue) {
                        requestAnimationFrame(render);
                }
        }
        playing = true;
        if (options.autoRestart) {
                startAutoRestartTimer();
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
