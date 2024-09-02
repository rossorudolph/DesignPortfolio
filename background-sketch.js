// background-sketch.js

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
            this.width = Math.random() * 60 + 30;
            this.height = Math.random() * 60 + 30;
            this.radius = Math.random() * 80 + 30;
            this.noiseOffset = Math.random() * 10;
            //this.speed = Math.random() * 0.8 + 0.1;
            this.speed = Math.random() * 0.05 + 0.15;
            this.feather = Math.random() * 50 + 70; /* 30 + 50 */
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
                let alpha = Math.floor((1 - inter) * 50);
                ctx.fillStyle = `rgba(233, 233, 233, ${alpha / 100})`; /* 213 */
                ctx.beginPath();
                ctx.ellipse(this.x, this.y, d, d, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
}

function draw() {
    ctx.fillStyle = 'rgb(250, 250, 250)'; /* 244 */
    ctx.fillRect(0, 0, width, height);

    for (let circle of circles) {
        circle.move();
        circle.display();
    }

    requestAnimationFrame(draw);
}

window.addEventListener('resize', resizeCanvas);
canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

// Initialize and start the animation
function initBackgroundSketch() {
    resizeCanvas();
    draw();
}

// Call this function when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initBackgroundSketch);
