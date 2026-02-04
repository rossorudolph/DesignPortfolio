// Plant Landscape — Selaginella & Fern Moss with Fog
// Growth pattern: main stem → paired lateral branches → sub-branches → leaflets
// Fog: ctx.filter blur on animated radial gradients (GPU-accelerated, zero lag)

const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
canvas.style.cursor = 'none'; // Hide default cursor, show custom smiley

let plants = [];
let sortedPlants = [];
let mouse = { x: -999, y: -999 };
let time = 0;
let needsResort = true;
let lastDropTime = 0;
let waterDrops = [];

// ─── Colors (from SVG reference) ─────────────────────────────────────────────
// Stem colors: green main stems
const STEM_COLORS = [
    { r: 93,  g: 160, b: 81 },   // #5DA051 medium green
    { r: 75,  g: 145, b: 85 },   // darker green
    { r: 110, g: 155, b: 90 },   // muted sage green
];
// Branch / leaflet greens - 3 main shades from dark to light
const BRANCH_COLORS = [
    { r: 48,  g: 114, b: 51 },   // #307233 deep dark green
    { r: 64,  g: 131, b: 63 },   // #40833F dark forest green
    { r: 75,  g: 140, b: 75 },   // medium dark green
    { r: 93,  g: 160, b: 81 },   // #5DA051 medium green
    { r: 110, g: 170, b: 95 },   // lighter medium green
    { r: 125, g: 185, b: 110 },  // light green
];
// Fog colors
const FOG_WHITE = 'rgba(240, 242, 238, ';

// Hills
let hills = [];

// Fog blobs (pre-generated, animated each frame)
let fogBlobs = [];

// ─── Canvas Setup ────────────────────────────────────────────────────────────
function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const cur = document.getElementById('cursorCanvas');
    if (cur) {
        cur.width  = window.innerWidth;
        cur.height = window.innerHeight;
    }
    initHills();
    initPlants();
    initFog();
    needsResort = true;
}

// ─── Hills ───────────────────────────────────────────────────────────────────
function initHills() {
    hills = [];
    for (let layer = 0; layer < 2; layer++) {
        const baseY  = canvas.height * (0.65 + layer * 0.18);
        const mounds = [];
        for (let h = 0; h < 4; h++) {
            const w      = canvas.width * (0.15 + Math.random() * 0.25);
            const cx     = canvas.width * (0.28 + Math.random() * 0.44);
            const startX = Math.max(0, cx - w / 2);
            const endX   = Math.min(canvas.width, cx + w / 2);
            const height = 38 - layer * 8;
            const pts    = [];
            for (let i = 0; i <= 20; i++) {
                const t = i / 20;
                pts.push({
                    x: startX + (endX - startX) * t,
                    y: baseY - Math.sin(t * Math.PI) * height * (0.7 + Math.random() * 0.3)
                });
            }
            mounds.push({ points: pts, centerX: cx, width: w });
        }
        hills.push({ mounds, shadeAlpha: layer === 0 ? 0.06 : 0.04 });
    }
}

function getGroundY(x) {
    // Find the highest (lowest y) hill surface at this x
    let best = canvas.height * 0.72;
    for (const hill of hills) {
        for (const m of hill.mounds) {
            if (x < m.points[0].x || x > m.points[m.points.length - 1].x) continue;
            for (let i = 0; i < m.points.length - 1; i++) {
                if (x >= m.points[i].x && x <= m.points[i + 1].x) {
                    const t = (x - m.points[i].x) / (m.points[i + 1].x - m.points[i].x);
                    const y = m.points[i].y + (m.points[i + 1].y - m.points[i].y) * t;
                    if (y < best) best = y;
                }
            }
        }
    }
    return best;
}

// ─── Bezier helpers ──────────────────────────────────────────────────────────
function quadPoint(p0x, p0y, p1x, p1y, p2x, p2y, t) {
    const u = 1 - t;
    return {
        x:  u * u * p0x + 2 * u * t * p1x + t * t * p2x,
        y:  u * u * p0y + 2 * u * t * p1y + t * t * p2y,
        // tangent (unnormalized)
        tx: 2 * u * (p1x - p0x) + 2 * t * (p2x - p1x),
        ty: 2 * u * (p1y - p0y) + 2 * t * (p2y - p1y)
    };
}

// ─── Plant Generation ────────────────────────────────────────────────────────
// Both selaginella and fern moss share the same bilateral growth logic.
// The difference is in proportions: fern moss arches more, branches are longer
// and more pendulous; selaginella is more compact and upright.

function generateBilateralStem(baseX, baseY, tipX, tipY, ctrlX, ctrlY, opts) {
    // opts: { numPairs, branchLenMin, branchLenMax, subPerBranch, leafsPerSub, leafLen, stemTaper }
    const pairs = [];
    const spacing = 1 / (opts.numPairs + 1);

    for (let i = 1; i <= opts.numPairs; i++) {
        const t = i * spacing;
        const pt = quadPoint(baseX, baseY, ctrlX, ctrlY, tipX, tipY, t);
        // Tangent angle
        const tLen  = Math.sqrt(pt.tx * pt.tx + pt.ty * pt.ty) || 1;
        const tAngl = Math.atan2(pt.ty / tLen, pt.tx / tLen);
        // Perpendicular directions (left / right of tangent)
        const perpL = tAngl - Math.PI * 0.5;
        const perpR = tAngl + Math.PI * 0.5;

        // Natural variation: branches aren't perfectly perpendicular
        const jitter = (Math.random() - 0.5) * 0.35;
        const taper  = 1 - t * (opts.stemTaper || 0.3); // branches get shorter toward tip

        const pair = [];
        for (let side = 0; side < 2; side++) {
            const baseAngle = side === 0 ? perpL + jitter : perpR - jitter;
            const len       = (opts.branchLenMin + Math.random() * (opts.branchLenMax - opts.branchLenMin)) * taper;

            // Sub-branches along this lateral branch
            const subs = [];
            const numSub = opts.subPerBranch;
            for (let s = 0; s < numSub; s++) {
                const st = 0.2 + (s / Math.max(1, numSub - 1)) * 0.65;
                // Sub-branch angle: fans out slightly from the branch direction
                const fan  = (Math.random() - 0.5) * 0.6;
                const sLen = len * (0.25 + Math.random() * 0.25) * (1 - st * 0.3);

                // Leaflet pairs along sub-branch
                const leaflets = [];
                const numLeaf  = opts.leafsPerSub;
                for (let L = 0; L < numLeaf; L++) {
                    const lt = L / Math.max(1, numLeaf - 1);
                    leaflets.push({
                        t:    lt,
                        len:  opts.leafLen * (1 - lt * 0.25) * taper,
                        side: L % 2 === 0 ? 1 : -1
                    });
                }
                subs.push({ t: st, angleFan: fan, length: sLen, leaflets });
            }

            pair.push({
                t:         t,
                angle:     baseAngle,
                length:    len,
                curve:     (Math.random() - 0.5) * 0.25,
                subs:      subs,
                colorIdx:  Math.floor(Math.random() * BRANCH_COLORS.length)
            });
        }
        pairs.push(pair);
    }
    return pairs;
}

function createSelaginella(x, y, depth) {
    // Selaginella: prostrate, spreading growth
    const scale    = 0.9 + depth * 0.7;
    const numStems = 2 + Math.floor(Math.random() * 2); // 2–3 stems
    const stems    = [];
    const numStarters = 1 + Math.floor(Math.random() * 2); // 1-2 starters

    for (let i = 0; i < numStems; i++) {
        // Prostrate - mostly horizontal left/right, slight upward bias, rarely vertical
        const horizontal = Math.random() < 0.5 ? 0 : Math.PI; // left or right
        const tilt = (Math.random() - 0.7) * 0.9; // mostly downward from horizontal, some up
        const stemAngle = horizontal + tilt;
        const stemLen   = (30 + Math.random() * 35) * scale;
        const tipX      = x + Math.cos(stemAngle) * stemLen;
        const tipY      = y + Math.sin(stemAngle) * stemLen;
        // Control point: slight curve
        const bend      = (Math.random() - 0.5) * stemLen * 0.4;
        const ctrlX     = x + (tipX - x) * 0.5 + Math.cos(stemAngle + Math.PI * 0.5) * bend;
        const ctrlY     = y + (tipY - y) * 0.5 + Math.sin(stemAngle + Math.PI * 0.5) * bend;

        const isStarter = i < numStarters;
        const growthDelay = isStarter ? 0 : 0.3; // overlap more - secondaries start while starters still growing

        stems.push({
            tipX, tipY, ctrlX, ctrlY,
            pairs: generateBilateralStem(x, y, tipX, tipY, ctrlX, ctrlY, {
                numPairs:     6 + Math.floor(Math.random() * 4),  // 6–9 pairs (more)
                branchLenMin: 8  * scale,
                branchLenMax: 16 * scale,
                subPerBranch: 3 + Math.floor(Math.random() * 2),  // 3–4 subs (more)
                leafsPerSub:  8 + Math.floor(Math.random() * 5),  // 8–12 leaflets (much denser!)
                leafLen:      2.5 * scale,  // slightly shorter so they don't overlap as much
                stemTaper:    0.3
            }),
            stemColorIdx: Math.floor(Math.random() * STEM_COLORS.length),
            growthProgress: 0,
            growthDelay: growthDelay
        });
    }

    plants.push({
        type: 'selaginella', x, y, depth,
        stems,
        scale,
        swayPhase: Math.random() * Math.PI * 2,
        alpha:     0.7 + depth * 0.25,
        fallen: false, collapseProgress: 0, collapseVelocity: 0,
        birthTime: Date.now()
    });
}

function createFernMoss(x, y, depth) {
    // Fern moss: prostrate, arching stems, longer pendulous branches
    const scale    = 1.0 + depth * 0.6;
    const numStems = 3 + Math.floor(Math.random() * 3); // 3–5 stems
    const stems    = [];
    const numStarters = 1 + Math.floor(Math.random() * 2); // 1-2 starters

    for (let i = 0; i < numStems; i++) {
        // Prostrate/arching - mostly horizontal with natural droop
        const horizontal = Math.random() < 0.5 ? 0 : Math.PI;
        const tilt = (Math.random() - 0.65) * 1.0; // mostly downward/horizontal, some up
        const stemAngle = horizontal + tilt;
        const stemLen   = (28 + Math.random() * 40) * scale;
        const tipX      = x + Math.cos(stemAngle) * stemLen;
        const tipY      = y + Math.sin(stemAngle) * stemLen;
        // Fern moss has more pronounced arching
        const bend      = (Math.random() - 0.5) * stemLen * 0.55;
        // Also add a slight downward droop via control point
        const ctrlX     = x + (tipX - x) * 0.45 + Math.cos(stemAngle + Math.PI * 0.5) * bend;
        const ctrlY     = y + (tipY - y) * 0.45 + Math.sin(stemAngle + Math.PI * 0.5) * bend + stemLen * 0.08;

        const isStarter = i < numStarters;
        const growthDelay = isStarter ? 0 : 0.3;

        stems.push({
            tipX, tipY, ctrlX, ctrlY,
            pairs: generateBilateralStem(x, y, tipX, tipY, ctrlX, ctrlY, {
                numPairs:     7 + Math.floor(Math.random() * 4),  // 7–10 pairs (denser)
                branchLenMin: 6  * scale,
                branchLenMax: 13 * scale,
                subPerBranch: 3,  // more subs
                leafsPerSub:  9 + Math.floor(Math.random() * 5),  // 9–13 (much denser!)
                leafLen:      2.0 * scale,  // shorter
                stemTaper:    0.35
            }),
            stemColorIdx: Math.floor(Math.random() * STEM_COLORS.length),
            growthProgress: 0,
            growthDelay: growthDelay
        });
    }

    plants.push({
        type: 'fernMoss', x, y, depth,
        stems,
        scale,
        swayPhase: Math.random() * Math.PI * 2,
        alpha:     0.65 + depth * 0.25,
        fallen: false, collapseProgress: 0, collapseVelocity: 0,
        birthTime: Date.now()
    });
}

function initPlants() {
    plants = [];
    const numPatches   = 5;
    const backRegions  = [];
    const frontRegions = [];

    for (let p = 0; p < numPatches; p++) {
        const isBack = p % 2 === 0;
        const depth  = isBack ? 0.15 + Math.random() * 0.3 : 0.6 + Math.random() * 0.3;
        const regions = isBack ? backRegions  : frontRegions;
        const other   = isBack ? frontRegions : backRegions;

        let cx, attempts = 0;
        do {
            cx = canvas.width * (0.25 + Math.random() * 0.5);
            attempts++;
        } while (attempts < 20 && (
            regions.some(r => Math.abs(cx - r.x) < r.r + 80) ||
            other.some(r  => Math.abs(cx - r.x) < r.r + 55)
        ));

        const radius = 70 + Math.random() * 90;
        regions.push({ x: cx, r: radius });

        const count = 2 + Math.floor(Math.random() * 3); // 2–4 plants per patch
        for (let i = 0; i < count; i++) {
            const px = cx + (Math.random() - 0.5) * radius * 1.2;
            const py = getGroundY(px) + (Math.random() - 0.5) * 4;

            if (Math.random() < 0.55) {
                createSelaginella(px, py, depth);
            } else {
                createFernMoss(px, py, depth);
            }
        }
    }

    // Small moss clusters on hill surfaces
    for (const hill of hills) {
        for (const m of hill.mounds) {
            const n = 1 + Math.floor(Math.random() * 2);
            for (let i = 0; i < n; i++) {
                const t   = 0.25 + Math.random() * 0.5;
                const idx = Math.floor(t * (m.points.length - 1));
                const pt  = m.points[Math.min(idx, m.points.length - 1)];
                createSelaginella(pt.x, pt.y, 0.2 + Math.random() * 0.3);
            }
        }
    }

    sortedPlants = [...plants].sort((a, b) => a.depth - b.depth);
}

// ─── Fog ─────────────────────────────────────────────────────────────────────
function initFog() {
    fogBlobs = [];
    const count = 7;
    for (let i = 0; i < count; i++) {
        fogBlobs.push({
            // Spread across the scene, clustered near the plant band
            cx:        canvas.width  * (0.1 + Math.random() * 0.8),
            cy:        canvas.height * (0.45 + Math.random() * 0.25),
            rx:        150 + Math.random() * 200,  // horizontal radius
            ry:        80  + Math.random() * 120,  // vertical radius
            phase:     Math.random() * Math.PI * 2,
            speed:     0.00008 + Math.random() * 0.00012,
            driftX:    (Math.random() - 0.5) * 40,  // amplitude of horizontal drift
            driftY:    (Math.random() - 0.5) * 15,
            alpha:     0.12 + Math.random() * 0.15, // more visible fog (was 0.025-0.065)
            layer:     i < 3 ? 'back' : (i < 5 ? 'mid' : 'front') // depth layering
        });
    }
}

function drawFogLayer(layerName) {
    ctx.save();
    ctx.filter = 'blur(25px)'; // GPU-accelerated blur, less diffused than before
    for (const f of fogBlobs) {
        if (f.layer !== layerName) continue;
        const cx = f.cx + Math.sin(time * f.speed + f.phase) * f.driftX;
        const cy = f.cy + Math.cos(time * f.speed * 0.7 + f.phase) * f.driftY;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(f.rx, f.ry));
        grad.addColorStop(0,    FOG_WHITE + f.alpha + ')');
        grad.addColorStop(0.55, FOG_WHITE + (f.alpha * 0.5) + ')');
        grad.addColorStop(1,    FOG_WHITE + '0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, f.rx, f.ry, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// ─── Hill Drawing ────────────────────────────────────────────────────────────
function drawHills() {
    for (const hill of hills) {
        for (const m of hill.mounds) {
            let minY = canvas.height, maxY = 0;
            for (const p of m.points) { if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }

            const grad = ctx.createLinearGradient(0, minY, 0, maxY);
            grad.addColorStop(0, `rgba(218, 220, 216, ${hill.shadeAlpha})`);
            grad.addColorStop(1, 'rgba(218, 220, 216, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(m.points[0].x, canvas.height);
            for (const p of m.points) {
                ctx.lineTo(p.x, p.y + Math.sin(time * 0.0001 + p.x * 0.005) * 0.8);
            }
            ctx.lineTo(m.points[m.points.length - 1].x, canvas.height);
            ctx.closePath();
            ctx.fill();
        }
    }
}

// ─── Plant Growth Update ─────────────────────────────────────────────────────
function updatePlants() {
    for (const plant of plants) {
        if (!plant.stems) continue;
        const age = (time - plant.birthTime) / 1000; // age in seconds

        for (const stem of plant.stems) {
            if (age < stem.growthDelay) {
                stem.growthProgress = 0;
            } else {
                // Grow over 1.8 seconds after delay, with strong ease-out
                const growthAge = age - stem.growthDelay;
                const t = Math.min(1, growthAge / 1.8);
                // Ease out quartic: very slow end
                stem.growthProgress = 1 - Math.pow(1 - t, 4);
            }
        }
    }
}

// ─── Plant Drawing ───────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }

function drawBilateralPlant(plant) {
    const dx  = mouse.x - plant.x;
    const dy  = mouse.y - plant.y;
    const dSq = dx * dx + dy * dy;

    // Tips curl toward cursor — but not for fallen plants
    let curlFactor = 0;
    if (!plant.fallen) {
        const curlRadiusSq = 220 * 220;
        if (dSq < curlRadiusSq) {
            const d = Math.sqrt(dSq);
            if (d > 0) {
                // Strength falls off with distance
                curlFactor = (1 - d / 220) * 0.4; // 0 to 0.4 max curl
            }
        }
    }
    
    // Collapse trigger at 40px
    if (!plant.fallen && dSq < 1600) {
        plant.fallen           = true;
        plant.collapseVelocity = 0.018;
        plant.fallDir          = plant.stems[0].ctrlX > plant.x ? 1 : -1;
    }
    if (plant.fallen) {
        plant.collapseVelocity += 0.0008;
        plant.collapseProgress += plant.collapseVelocity;
        if (plant.collapseProgress > 1) plant.collapseProgress = 1;
    }

    const fall  = plant.fallen ? plant.collapseProgress : 0;
    const cFact = 1 - fall * 0.55;
    const sway  = Math.sin(time * 0.00018 + plant.swayPhase) * (1.5 + plant.depth * 2.5);
    
    // Base stays fixed
    const baseX = plant.x;
    const baseY = plant.y;

    // Single color per plant
    const stemCol = STEM_COLORS[plant.stems[0].stemColorIdx];
    const brCol   = BRANCH_COLORS[plant.stems[0].pairs[0]?.[0]?.colorIdx ?? 0];
    const dryR = 185, dryG = 168, dryB = 130;
    const stemR = lerp(stemCol.r, dryR, fall)|0;
    const stemG = lerp(stemCol.g, dryG, fall)|0;
    const stemB = lerp(stemCol.b, dryB, fall)|0;
    const brR   = lerp(brCol.r,   dryR, fall)|0;
    const brG   = lerp(brCol.g,   dryG, fall)|0;
    const brB   = lerp(brCol.b,   dryB, fall)|0;

    const stemPath   = new Path2D();
    const branchPath = new Path2D();
    const detailPath = new Path2D();

    for (const stem of plant.stems) {
        if (stem.growthProgress === 0) continue;

        const sx         = baseX;
        const sy         = baseY;
        const swayOffset = sway * cFact;
        const fallDir    = plant.fallDir ?? (stem.ctrlX > plant.x ? 1 : -1);
        const fallShiftX = fall * plant.scale * 40 * fallDir; // more horizontal spread
        const fallShiftY = fall * plant.scale * 8; // less vertical shift - lay flat
        const gScale     = stem.growthProgress;

        // Original tip position (without curl)
        const origTipX = baseX + ((stem.tipX - plant.x) + swayOffset + fallShiftX) * cFact * gScale;
        const origTipY = baseY + ((stem.tipY - plant.y) + fallShiftY) * cFact * gScale;
        
        // If cursor nearby, curl tip toward it
        let tipXr = origTipX;
        let tipYr = origTipY;
        if (curlFactor > 0) {
            // Angle from tip to mouse
            const tipDx = mouse.x - origTipX;
            const tipDy = mouse.y - origTipY;
            const tipDist = Math.sqrt(tipDx * tipDx + tipDy * tipDy);
            if (tipDist > 0) {
                // Pull tip toward mouse
                const pullX = (tipDx / tipDist) * 15 * curlFactor;
                const pullY = (tipDy / tipDist) * 15 * curlFactor;
                tipXr += pullX;
                tipYr += pullY;
            }
        }
        
        // Control point: influenced by curl to create curve
        const ctrlXr = baseX + ((stem.ctrlX - plant.x) + swayOffset * 0.6) * cFact * gScale + (tipXr - origTipX) * 0.5;
        const ctrlYr = baseY + ((stem.ctrlY - plant.y)) * cFact * gScale + (tipYr - origTipY) * 0.5;

        stemPath.moveTo(sx, sy);
        stemPath.quadraticCurveTo(ctrlXr, ctrlYr, tipXr, tipYr);

        // Branches
        for (const pair of stem.pairs) {
            const pt = quadPoint(sx, sy, ctrlXr, ctrlYr, tipXr, tipYr, pair[0].t);

            for (const branch of pair) {
                const bLen   = branch.length * cFact * gScale;
                const bEndX  = pt.x + Math.cos(branch.angle) * bLen;
                const bEndY  = pt.y + Math.sin(branch.angle) * bLen;
                const bCtrlX = pt.x + (bEndX - pt.x) * 0.5 + Math.cos(branch.angle + Math.PI * 0.5) * bLen * branch.curve;
                const bCtrlY = pt.y + (bEndY - pt.y) * 0.5 + Math.sin(branch.angle + Math.PI * 0.5) * bLen * branch.curve;

                branchPath.moveTo(pt.x, pt.y);
                branchPath.quadraticCurveTo(bCtrlX, bCtrlY, bEndX, bEndY);

                for (const sub of branch.subs) {
                    const sp       = quadPoint(pt.x, pt.y, bCtrlX, bCtrlY, bEndX, bEndY, sub.t);
                    const subAngle = branch.angle + sub.angleFan;
                    const sLen     = sub.length * cFact * gScale;
                    const sEndX    = sp.x + Math.cos(subAngle) * sLen;
                    const sEndY    = sp.y + Math.sin(subAngle) * sLen;

                    detailPath.moveTo(sp.x, sp.y);
                    detailPath.lineTo(sEndX, sEndY);

                    const subTangent = Math.atan2(sEndY - sp.y, sEndX - sp.x);
                    for (const leaf of sub.leaflets) {
                        const lx        = sp.x + (sEndX - sp.x) * leaf.t;
                        const ly        = sp.y + (sEndY - sp.y) * leaf.t;
                        const leafAngle = subTangent + leaf.side * (Math.PI * 0.42) - Math.PI * 0.08 * leaf.side;
                        const leafLen   = leaf.len * cFact * gScale;
                        detailPath.moveTo(lx, ly);
                        detailPath.lineTo(lx + Math.cos(leafAngle) * leafLen, ly + Math.sin(leafAngle) * leafLen);
                    }
                }
            }
        }
    }

    // 3 stroke calls total
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(${stemR}, ${stemG}, ${stemB}, ${plant.alpha * 0.85})`;
    ctx.lineWidth   = (1.0 + plant.depth * 0.5) * plant.scale;
    ctx.stroke(stemPath);

    ctx.strokeStyle = `rgba(${brR}, ${brG}, ${brB}, ${plant.alpha * 0.78})`;
    ctx.lineWidth   = (0.6 + plant.depth * 0.25) * plant.scale;
    ctx.stroke(branchPath);

    ctx.strokeStyle = `rgba(${brR}, ${brG}, ${brB}, ${plant.alpha * 0.5})`;
    ctx.lineWidth   = 0.3 * plant.scale;
    ctx.stroke(detailPath);
}

// ─── Water Drops (cursor trail) ──────────────────────────────────────────────
function updateWaterDrops() {
    for (let i = waterDrops.length - 1; i >= 0; i--) {
        const d = waterDrops[i];
        d.vy  += 0.08;
        d.x   += d.vx;
        d.y   += d.vy;
        d.life -= 0.025;
        if (d.life <= 0) waterDrops.splice(i, 1);
    }
}

function drawWaterDrops() {
    for (const d of waterDrops) {
        ctx.globalAlpha = d.life * 0.55;
        ctx.fillStyle   = 'rgba(180, 210, 220, 1)';
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.size * 0.4, d.size * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// ─── Cursor (drawn on main ctx and on top-layer cursor canvas so visible over bio) ─
function drawCursorOn(ctx) {
    ctx.save();
    ctx.translate(mouse.x, mouse.y);
    ctx.rotate(time * 0.0015);
    const s = 7;
    ctx.fillStyle   = 'rgba(255,255,255,0.9)';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.beginPath(); ctx.arc(-s * 0.28, -s * 0.18, s * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth   = 1.2;
    ctx.beginPath(); ctx.arc(s * 0.28, -s * 0.18, s * 0.14, 0, Math.PI); ctx.stroke();
    ctx.lineWidth   = 1.3;
    ctx.beginPath(); ctx.arc(0, s * 0.08, s * 0.38, 0.22, Math.PI - 0.22); ctx.stroke();
    ctx.restore();
}

function drawCursor() {
    drawCursorOn(ctx);
    const cur = document.getElementById('cursorCanvas');
    if (cur && cur.getContext) {
        const cctx = cur.getContext('2d');
        cctx.clearRect(0, 0, cur.width, cur.height);
        drawCursorOn(cctx);
    }
}

// ─── Main Loop ───────────────────────────────────────────────────────────────
function draw() {
    time = Date.now();

    // Background: soft white-to-cream gradient
    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, 'rgb(252, 252, 250)');
    bg.addColorStop(1, 'rgb(245, 246, 248)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    updateWaterDrops();
    updatePlants();

    // ── Back fog ──
    drawFogLayer('back');

    // ── Split plants into back / front ──
    const splitIdx = Math.floor(sortedPlants.length * 0.45);

    // Back plants — foggy/muted
    ctx.globalAlpha = 0.6; // Reduce opacity for atmospheric depth
    for (let i = 0; i < splitIdx; i++) {
        drawBilateralPlant(sortedPlants[i]);
    }
    ctx.globalAlpha = 1.0;

    // ── Mid fog (between layers) ──
    drawFogLayer('mid');

    // ── Hills (obscure back plants) ──
    drawHills();

    // ── Front plants (sharp) ──
    for (let i = splitIdx; i < sortedPlants.length; i++) {
        drawBilateralPlant(sortedPlants[i]);
    }

    // ── Front fog (subtle veil over everything) ──
    drawFogLayer('front');

    // ── Water + cursor ──
    drawWaterDrops();
    drawCursor();

    requestAnimationFrame(draw);
}

// ─── Events (document so cursor and mouse position work over overlay/bio too) ─────
function onMouseMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    const now = Date.now();
    if (now - lastDropTime > 90 && Math.random() > 0.88) {
        waterDrops.push({
            x: mouse.x + (Math.random() - 0.5) * 8,
            y: mouse.y,
            vx: (Math.random() - 0.5) * 0.4,
            vy: 0.3 + Math.random() * 0.8,
            size: 1.8 + Math.random() * 2,
            life: 1.0
        });
        lastDropTime = now;
        if (waterDrops.length > 18) waterDrops.shift();
    }
}
canvas.addEventListener('mousemove', onMouseMove);
document.addEventListener('mousemove', onMouseMove);

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
draw();