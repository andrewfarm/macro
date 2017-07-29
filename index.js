var canvas = document.getElementById('canvas');
const pixelRatio = window.devicePixelRatio || 1;
console.log('window.devicePixelRatio', window.devicePixelRatio);
canvas.style.width = window.innerWidth;
canvas.style.height = window.innerHeight;
canvas.width = window.innerWidth;// * pixelRatio;
canvas.height = window.innerHeight;// * pixelRatio;

const gl = canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl');
const universe = new Universe(gl);

function render() {
        universe.nextFrame();
        requestAnimationFrame(render);
}
render();
