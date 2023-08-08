let circles = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  initializeCircles(); // Initialize circles
}

function mousePressed() {
  if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
    let fs = fullscreen();
    fullscreen(!fs);
    if (fullscreen()) {
      resizeCanvas(windowWidth, windowHeight);
      initializeCircles(); // Reset circle positions
    } else {
      resizeCanvas(700, 700);
    }
  }
}

function windowResized() {
  if (fullscreen()) {
    resizeCanvas(windowWidth, windowHeight);
    initializeCircles(); // Reset circle positions
  } else {
    resizeCanvas(700, 700);
  }
}

function initializeCircles() {
  circles = []; // Clear existing circles
  for (let i = 0; i < 10; i++) {
    circles.push(new Circle(random(width), random(height)));
  }
}

function draw() {
  background(30);
  for (let circle of circles) {
    circle.move(); // Call move() on individual circle
    circle.display();
  }
}

class Circle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = random(30, 90); // Random width
    this.height = random(30, 90); // Random height
    this.radius = random(30, 110);
    this.noiseOffset = random(10);
    this.speed = random(0.1, 0.9);
    this.feather = random(50, 80);
  }

  move() {
    // Calculate the wrapped position including radius
    this.x = (this.x + this.speed * cos(this.noiseOffset)) % (width + this.radius);
    this.y = (this.y + this.speed * sin(this.noiseOffset + 1000)) % (height + this.radius);
    this.noiseOffset += 0.01;
  }

  display() {
    for (let d = this.radius + this.feather; d > this.radius; d -= 2) {
      let inter = map(d, this.radius, this.radius + this.feather, 0, 1);
      let c = lerpColor(color(90, 90, 60, 50), color(90, 90, 60, 0), inter);
      fill(c);
      ellipse(this.x, this.y, d * 2);
    }
  }
}
