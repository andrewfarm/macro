var canvas = document.getElementById('canvas');
const pixelRatio = window.devicePixelRatio || 1;
canvas.style.width = window.clientWidth;
canvas.style.height = window.clientHeight;
canvas.width = canvas.style.width * pixelRatio;
canvas.height = canvas.style.height * pixelRatio;

const gl = canvas.getContext('webgl');
const universe = new Universe(gl);

function render() {
        universe.nextFrame();
        requestAnimationFrame(render);
}
render();
