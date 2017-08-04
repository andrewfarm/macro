const MOUSE_SENSITIVITY = 800.0;

var canvas = document.getElementById('canvas');

const gl = canvas.getContext('webgl2');
if (gl) {
        //const pixelRatio = window.devicePixelRatio || 1;
        //console.log('window.devicePixelRatio', window.devicePixelRatio);
        canvas.style.width = window.innerWidth;
        canvas.style.height = window.innerHeight;
        canvas.width = window.innerWidth;// * pixelRatio;
        canvas.height = window.innerHeight;// * pixelRatio;
        var rect = canvas.getBoundingClientRect();
        
        var universe = new Universe(gl);
        canvas.addEventListener('mousemove',
                function(event) {
                        var camX = ((event.clientX - rect.left) /
                                canvas.width * 2.0 - 1.0) *
                                MOUSE_SENSITIVITY;
                        var camY = ((event.clientY - rect.top) /
                                canvas.height * -2.0 + 1.0) *
                                MOUSE_SENSITIVITY;
                        var camZ = universe.camPos[2];
                        universe.moveCamera([camX, camY, camZ]);
                });
        document.addEventListener('keypress',
                function(event) {
                        if (event.which === 108) { // 'l'
                                universe.lightMode = !universe.lightMode;
                        } else if (event.which === 13) { // enter
                                var temp = universe;
                                universe = new Universe(gl);
                                universe.lightMode = temp.lightMode;
                        }
                });

        function render() {
                universe.nextFrame();
                requestAnimationFrame(render);
        }
        requestAnimationFrame(render);
} else {
        document.body.innerHTML =
                '<div>\
                        <h1 class="red">Critical Failure</h1>\
                        <p>WebGL 2 missing from browser<p>\
                        <h2 class="green">2 solutions found</h2>\
                        <ul>\
                                <li><a href="http://firefox.com">Use Firefox &raquo;</a></li>\
                                <li><a href="http://chrome.com">Use Chrome &raquo;</a></li>\
                        </ul>\
                </div>';
}
