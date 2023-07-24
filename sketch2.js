let mic;
let fft;
let x = 1;
let p = 1;
let easing = 0.3;
let r = 10;

function setup() {
 createCanvas(windowWidth, windowHeight);
mic = new p5.AudioIn();
mic.start();
fft = new p5.FFT(0.8,64);
fft.setInput(mic);
}

function draw() {
background(0);
let spectrum = fft.analyze();
noStroke();
fill(255);

  for (let i = 0; i < spectrum.length; i++) {
  let x = map(i, 0, spectrum.length, 0, width);
  let h = -height + map(spectrum[i], 0, 255, height, 0);
    
  // let targetH = h;
  // let dh = targetH - p;
  // p += dh * easing;
    
  //rect(x, height, width / spectrum.length, p);
  ellipse(x+displayWidth/2, h + displayHeight/2, r, r);
  ellipse(-x+displayWidth/2, h + displayHeight/2, r, r);
  ellipse(x+displayWidth/2, -h + displayHeight/2, r, r);
  ellipse(-x+displayWidth/2, -h + displayHeight/2, r, r);
  fill(-h);

}
}
