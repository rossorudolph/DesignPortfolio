// background-sketch-green.js
// Dark green variant of the floating orb background sketch for project pages.

const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

let circles = [];
let width, height;
let mouseX = 0, mouseY = 0;

function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    initializeCircles();
}

function initializeCircles() {
    circles = [];
    for (let i = 0; i < 10; i++) {
        circles.push(new Circle(Math.random() * width, Math.random() * height));
    }
}

class Circle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = Math.random() * 80 + 30;
        this.noiseOffset = Math.random() * 10;
        this.speed = Math.random() * 0.05 + 0.15;
        this.feather = Math.random() * 50 + 70;
        this.avoidanceRadius = 300;
        this.maxAvoidanceForce = 1;
    }

    move() {
        let dx = this.speed * Math.cos(this.noiseOffset);
        let dy = this.speed * Math.sin(this.noiseOffset + 1000);

        let distToMouse = Math.hypot(this.x - mouseX, this.y - mouseY);
        if (distToMouse < this.avoidanceRadius) {
            let avoidanceFactor = (this.avoidanceRadius - distToMouse) / this.avoidanceRadius;
            let avoidanceForce = Math.min(avoidanceFactor * this.maxAvoidanceForce, this.maxAvoidanceForce);
            dx += avoidanceForce * (this.x - mouseX) / distToMouse;
            dy += avoidanceForce * (this.y - mouseY) / distToMouse;
        }

        this.x += dx;
        this.y += dy;

        const totalRadius = this.radius + this.feather;
        if (this.x < -totalRadius) this.x = width + totalRadius;
        if (this.x > width + totalRadius) this.x = -totalRadius;
        if (this.y < -totalRadius) this.y = height + totalRadius;
        if (this.y > height + totalRadius) this.y = -totalRadius;

        this.noiseOffset += 0.01;
    }

    display() {
        for (let d = this.radius + this.feather; d > this.radius; d -= 2) {
            let inter = (d - this.radius) / this.feather;
            let alpha = (1 - inter) * 0.032;
            ctx.fillStyle = `rgba(188, 210, 190, ${alpha})`;
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, d, d, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

let cursorCanvas, cursorCtx;
let cursorTime = 0;

function initCursor() {
    cursorCanvas = document.getElementById('cursorCanvas');
    if (!cursorCanvas) {
        cursorCanvas = document.createElement('canvas');
        cursorCanvas.id = 'cursorCanvas';
        cursorCanvas.setAttribute('aria-hidden', 'true');
        cursorCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:30;';
        document.body.appendChild(cursorCanvas);
    }
    cursorCtx = cursorCanvas.getContext('2d');
    cursorCanvas.width = width;
    cursorCanvas.height = height;
    document.body.style.cursor = 'none';
    canvas.style.cursor = 'none';
}

function drawSmiley() {
    if (!cursorCtx) return;
    cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    cursorCtx.save();
    cursorCtx.translate(mouseX, mouseY);
    cursorCtx.rotate(cursorTime * 0.0015);
    var s = 7;
    cursorCtx.fillStyle = 'rgba(255,255,255,0.9)';
    cursorCtx.strokeStyle = 'rgba(0,0,0,0.6)';
    cursorCtx.lineWidth = 1;
    cursorCtx.beginPath(); cursorCtx.arc(0, 0, s, 0, Math.PI * 2); cursorCtx.fill(); cursorCtx.stroke();
    cursorCtx.fillStyle = 'rgba(0,0,0,0.85)';
    cursorCtx.beginPath(); cursorCtx.arc(-s * 0.28, -s * 0.18, s * 0.14, 0, Math.PI * 2); cursorCtx.fill();
    cursorCtx.strokeStyle = 'rgba(0,0,0,0.85)';
    cursorCtx.lineWidth = 1.2;
    cursorCtx.beginPath(); cursorCtx.arc(s * 0.28, -s * 0.18, s * 0.14, 0, Math.PI); cursorCtx.stroke();
    cursorCtx.lineWidth = 1.3;
    cursorCtx.beginPath(); cursorCtx.arc(0, s * 0.08, s * 0.38, 0.22, Math.PI - 0.22); cursorCtx.stroke();
    cursorCtx.restore();
}

function draw() {
    ctx.fillStyle = '#0d2516';
    ctx.fillRect(0, 0, width, height);

    for (let circle of circles) {
        circle.move();
        circle.display();
    }

    cursorTime = performance.now() * 0.001;
    drawSmiley();

    requestAnimationFrame(draw);
}

window.addEventListener('resize', function() {
    resizeCanvas();
    if (cursorCanvas) {
        cursorCanvas.width = width;
        cursorCanvas.height = height;
    }
});
document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

function initBackgroundSketch() {
    resizeCanvas();
    initCursor();
    draw();
}

document.addEventListener('DOMContentLoaded', initBackgroundSketch);
