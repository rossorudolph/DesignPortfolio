// Minimal Ecosystem - Sparse Grass with Sketchy Wind Lines
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

let grassBlades = [];
let windLines = [];
let mouse = { x: 0, y: 0 };
let avoidanceRadius = 100;
let flyOffRadius = 80; // Radius for fly-off interaction
let time = 0;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initEcosystem();
}

function initEcosystem() {
    grassBlades = [];
    windLines = [];
    
    // Create sparse grass cluster - OFFSET TO LEFT - 2X LARGER
    const centerX = canvas.width / 2 - 40; // Offset 40px to the left
    const centerY = canvas.height / 2;
    const numBlades = 10;
    const scale = 2; // 2x larger
    
    for (let i = 0; i < numBlades; i++) {
        const angle = (Math.random() - 0.5) * Math.PI * 0.5;
        const distance = Math.random() * 100 * scale;
        
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance * 0.3;
        
        grassBlades.push({
            x: x,
            y: y,
            baseX: x,
            baseY: y,
            height: (50 + Math.random() * 70) * scale,
            width: (0.8 + Math.random() * 0.6) * scale,
            swaySpeed: 0.0004 + Math.random() * 0.0003,
            swayAmount: (3 + Math.random() * 6) * scale,
            phase: Math.random() * Math.PI * 2,
            curviness: 0.1 + Math.random() * 0.15,
            hasWheat: Math.random() < 0.3,
            wheatSize: (2 + Math.random() * 3) * scale,
            flying: false,
            flyVelocityX: 0,
            flyVelocityY: 0,
            flyRotation: 0,
            flyRotationSpeed: 0
        });
    }
    
    // Create smooth wind lines - NON-UNIFORM distribution (atmospheric) - 2X LARGER
    // 2 lines at top (sky), then gap, then lines around grass
    const allLinePositions = [
        centerY - 110 * scale,  // Top line 1 (sky)
        centerY - 95 * scale,   // Top line 2 (sky) - separated slightly
        // GAP - removed 3rd line for sky separation
        centerY - 50 * scale,
        centerY - 30 * scale,
        centerY - 10 * scale,
        centerY + 5 * scale,
        centerY + 15 * scale    // Near grass level
    ];
    
    for (let i = 0; i < allLinePositions.length; i++) {
        const baseY = allLinePositions[i];
        
        // Generate control points for smooth organic curves - 2X WIDER
        const numSegments = 8 + Math.floor(Math.random() * 4);
        const controlPoints = [];
        
        for (let s = 0; s <= numSegments; s++) {
            controlPoints.push({
                x: (s / numSegments) * 150 * scale - 75 * scale, // 2x wider
                y: (Math.random() - 0.5) * 18 * scale, // 2x taller
                wobbleSpeed: 0.0006 + Math.random() * 0.0008,
                wobbleAmount: (3 + Math.random() * 5) * scale, // 2x larger wobble
                wobblePhase: Math.random() * Math.PI * 2
            });
        }
        
        windLines.push({
            baseY: baseY,
            controlPoints: controlPoints
        });
    }
}

canvas.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

function drawSketchyWindLine(line, time) {
    ctx.strokeStyle = 'rgba(80, 80, 80, 0.35)'; // Darkened from 0.25 to 0.35
    ctx.lineWidth = 0.8; // 2x thicker for 2x scale
    ctx.lineCap = 'round';
    
    const centerX = canvas.width / 2;
    
    // Animate each control point smoothly
    const animatedPoints = line.controlPoints.map((pt) => {
        const wobble = Math.sin(time * pt.wobbleSpeed + pt.wobblePhase) * pt.wobbleAmount;
        return {
            x: centerX + pt.x + wobble,
            y: line.baseY + pt.y + wobble * 0.3
        };
    });
    
    // Draw smooth spline-like curve
    ctx.beginPath();
    
    if (animatedPoints.length > 0) {
        ctx.moveTo(animatedPoints[0].x, animatedPoints[0].y);
        
        // Use smooth bezier curves for spline effect
        for (let i = 1; i < animatedPoints.length - 1; i++) {
            const curr = animatedPoints[i];
            const next = animatedPoints[i + 1];
            
            // Calculate smooth control point
            const cpX = curr.x;
            const cpY = curr.y;
            const endX = (curr.x + next.x) / 2;
            const endY = (curr.y + next.y) / 2;
            
            ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        }
        
        // Final segment
        if (animatedPoints.length > 1) {
            const last = animatedPoints[animatedPoints.length - 1];
            const secondLast = animatedPoints[animatedPoints.length - 2];
            ctx.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y);
        }
    }
    
    ctx.stroke();
}

function drawGrassBlade(blade, time) {
    // Check if blade should fly off
    const tipX = blade.baseX;
    const tipY = blade.baseY - blade.height;
    const dx = mouse.x - tipX;
    const dy = mouse.y - tipY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Trigger fly-off when cursor gets close
    if (!blade.flying && distance < flyOffRadius && distance > 0) {
        blade.flying = true;
        // Calculate fly-off velocity away from mouse
        const angle = Math.atan2(dy, dx) + Math.PI; // Opposite direction
        const speed = 5 + Math.random() * 10;
        blade.flyVelocityX = Math.cos(angle) * speed;
        blade.flyVelocityY = Math.sin(angle) * speed;
        blade.flyRotation = Math.random() * Math.PI * 2;
        blade.flyRotationSpeed = (Math.random() - 0.5) * 0.2;
    }
    
    // Update flying blade (no gravity)
    if (blade.flying) {
        blade.baseX += blade.flyVelocityX;
        blade.baseY += blade.flyVelocityY;
        blade.flyRotation += blade.flyRotationSpeed;
        
        // Fade out as it flies away
        const fadeDistance = Math.sqrt(
            Math.pow(blade.baseX - canvas.width / 2, 2) + 
            Math.pow(blade.baseY - canvas.height / 2, 2)
        );
        const maxDistance = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height);
        const opacity = Math.max(0, 1 - fadeDistance / maxDistance);
        
        // If blade is off screen or faded, don't draw it
        if (opacity <= 0 || blade.baseX < -100 || blade.baseX > canvas.width + 100 || 
            blade.baseY < -100 || blade.baseY > canvas.height + 100) {
            return; // Don't draw this blade anymore
        }
        
        // Draw flying blade with rotation
        ctx.save();
        ctx.translate(blade.baseX, blade.baseY);
        ctx.rotate(blade.flyRotation);
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -blade.height);
        
        ctx.strokeStyle = `rgba(40, 40, 40, ${0.8 * opacity})`;
        ctx.lineWidth = blade.width;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        ctx.restore();
        return;
    }
    
    // Normal sway behavior for non-flying blades
    const baseSway = Math.sin(time * blade.swaySpeed + blade.phase) * blade.swayAmount;
    const midWave = Math.sin(time * blade.swaySpeed * 1.5 + blade.phase) * blade.swayAmount * 0.4;
    
    // Calculate initial tip position (before mouse)
    const initialTipX = blade.baseX + baseSway;
    const initialTipY = blade.baseY - blade.height;
    
    // Mouse avoidance on TIP - grass shies away from cursor
    const mouseDx = mouse.x - initialTipX;
    const mouseDy = mouse.y - initialTipY;
    const mouseDistance = Math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy);
    
    let tipAvoidX = 0;
    let tipAvoidY = 0;
    if (mouseDistance < avoidanceRadius && mouseDistance > 0) {
        const force = Math.pow(1 - mouseDistance / avoidanceRadius, 2);
        tipAvoidX = -(mouseDx / mouseDistance) * force * 8;
        tipAvoidY = -(mouseDy / mouseDistance) * force * 5;
    }
    
    // Apply avoidance to tip
    const finalTipX = initialTipX + tipAvoidX;
    const finalTipY = initialTipY + tipAvoidY;
    
    // Control points (propagate some of the tip movement down)
    const curve1X = blade.baseX + (baseSway * 0.3) + (midWave * 0.3) + tipAvoidX * 0.2;
    const curve1Y = blade.baseY - blade.height * 0.35;
    
    const curve2X = blade.baseX + (baseSway * 0.7) + (midWave * 0.5) + tipAvoidX * 0.6;
    const curve2Y = blade.baseY - blade.height * 0.75;
    
    // Draw blade in black
    ctx.beginPath();
    ctx.moveTo(blade.baseX, blade.baseY);
    ctx.bezierCurveTo(curve1X, curve1Y, curve2X, curve2Y, finalTipX, finalTipY);
    
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.8)';
    ctx.lineWidth = blade.width;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Draw wheat tip if applicable (in black/gray)
    if (blade.hasWheat) {
        const wheatSway = Math.sin(time * blade.swaySpeed * 2 + blade.phase) * 1.5;
        
        ctx.fillStyle = 'rgba(60, 60, 60, 0.7)';
        
        for (let i = 0; i < 4; i++) {
            const offsetX = (Math.random() - 0.5) * blade.wheatSize * 0.6;
            const offsetY = -i * blade.wheatSize * 0.5;
            
            ctx.beginPath();
            ctx.ellipse(
                finalTipX + wheatSway + offsetX,
                finalTipY + offsetY,
                blade.wheatSize * 0.3,
                blade.wheatSize * 0.6,
                Math.PI / 4,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
    }
}

function draw() {
    time = Date.now();
    
    // Clear with light gray background (B&W aesthetic)
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw sketchy wind lines first
    for (let line of windLines) {
        drawSketchyWindLine(line, time);
    }
    
    // Draw grass blades
    for (let blade of grassBlades) {
        drawGrassBlade(blade, time);
    }
    
    requestAnimationFrame(draw);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
draw();
