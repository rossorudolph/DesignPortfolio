import * as THREE from './three.module.min.js';

const canvas = document.getElementById('myCanvas');
if (!canvas) {
    console.error('psychedelic-landscape-sketch-3d: #myCanvas not found.');
} else {
    canvas.style.cursor = 'none';

    let scene, camera, renderer;
    let hillMesh, shadowCatcher, mossGroup, shimmerGroup, fogGroup;
    let moth;
    let time = 0;
    const mouse = { x: -999, y: -999 };

    const mouseNDC = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const cursorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const cursorTarget = new THREE.Vector3();
    const cursorTargetLocal = new THREE.Vector3(1000, 0, 1000);

    const tempWorld = new THREE.Vector3();
    const tempLocal = new THREE.Vector3();

    const STEM_COLORS = [
        { r: 224, g: 232, b: 222 },
        { r: 214, g: 224, b: 212 },
        { r: 232, g: 239, b: 230 },
        { r: 200, g: 209, b: 201 },
    ];
    const BRANCH_COLORS = [
        { r: 208, g: 220, b: 206 },
        { r: 220, g: 231, b: 218 },
        { r: 232, g: 240, b: 230 },
        { r: 198, g: 212, b: 196 },
        { r: 184, g: 196, b: 188 },
        { r: 238, g: 244, b: 236 },
    ];
    const DEAD_FROND_COLOR = new THREE.Color(0x4b4f52);

    function rgb(c) {
        return new THREE.Color(c.r / 255, c.g / 255, c.b / 255);
    }

    const leafGeo = new THREE.CylinderGeometry(0.00045, 0.0016, 0.052, 6);
    const tinyLeafGeo = new THREE.CylinderGeometry(0.0003, 0.0010, 0.028, 6);
    const UP = new THREE.Vector3(0, 1, 0);
    const mossFronds = [];
    const shimmerDots = [];
    const fogVeils = [];
    const screenGlitches = [];
    const mothTarget = new THREE.Vector3();

    function taperEase(t) {
        if (t <= 0.72) return t * (0.12 / 0.72);
        return 0.12 + (t - 0.72) / 0.28 * 0.88;
    }

    function addTaperedSegment(parent, start, end, r0, r1, material) {
        const dir = new THREE.Vector3().subVectors(end, start);
        const len = dir.length();
        if (len < 0.0001) return;

        const geo = new THREE.CylinderGeometry(r1, r0, len, 6, 1, false);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.copy(start).lerp(end, 0.5);
        mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        parent.add(mesh);
    }

    function createFrond(scale) {
        const pivot = new THREE.Group();
        const stemCol = rgb(STEM_COLORS[Math.floor(Math.random() * STEM_COLORS.length)]);
        const leafCol = rgb(BRANCH_COLORS[Math.floor(Math.random() * BRANCH_COLORS.length)]);

        const stemMat = new THREE.MeshStandardMaterial({
            color: stemCol,
            roughness: 0.86,
            metalness: 0.0,
        });
        const leafMats = [
            new THREE.MeshStandardMaterial({
                color: leafCol.clone().offsetHSL(-0.015, 0.06, -0.03),
                roughness: 0.88,
                metalness: 0.0,
            }),
            new THREE.MeshStandardMaterial({
                color: leafCol.clone().offsetHSL(0.01, 0.08, 0.02),
                roughness: 0.88,
                metalness: 0.0,
            }),
            new THREE.MeshStandardMaterial({
                color: leafCol.clone().offsetHSL(-0.005, 0.03, 0.05),
                roughness: 0.88,
                metalness: 0.0,
            }),
        ];

        // Prostrate runner: mostly horizontal, hugging the ground.
        const len = (0.24 + Math.random() * 0.18) * scale;
        const points = [];
        const segments = 12;
        const straighter = Math.random() < 0.4;
        const curveAmp = (straighter ? (0.006 + Math.random() * 0.012) : (0.016 + Math.random() * 0.024)) * scale;
        const phase = Math.random() * Math.PI * 2;
        const droop = (straighter ? (0.005 + Math.random() * 0.01) : (0.007 + Math.random() * 0.02)) * scale;
        const lift = (straighter ? (0.02 + Math.random() * 0.024) : (0.03 + Math.random() * 0.05)) * scale;
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = t * len;
            // Start grounded, rise up, then curve tip back down.
            const yArc = Math.sin(t * Math.PI) * lift;
            const yTipDrop = Math.pow(t, 1.45) * droop;
            const y = Math.max(-0.006, yArc - yTipDrop + (Math.random() - 0.5) * 0.0008);
            const z = Math.sin(t * 2.1 + phase) * curveAmp * (1 - t * 0.22);
            points.push(new THREE.Vector3(x, y, z));
        }

        // Tapered central stem: gradual thickness most of length, then abrupt taper at tip.
        for (let i = 0; i < points.length - 1; i++) {
            const t0 = i / (points.length - 1);
            const t1 = (i + 1) / (points.length - 1);
            const e0 = taperEase(t0);
            const e1 = taperEase(t1);
            const r0 = THREE.MathUtils.lerp(0.0025 * scale, 0.0009 * scale, e0);
            const r1 = THREE.MathUtils.lerp(0.0025 * scale, 0.0009 * scale, e1);
            addTaperedSegment(pivot, points[i], points[i + 1], r0, r1, stemMat);
        }

        // Primary and secondary leaflets, decreasing toward the tip.
        for (let i = 1; i < points.length - 2; i++) {
            const t = i / (points.length - 1);
            const p = points[i];
            const tangent = new THREE.Vector3().subVectors(points[i + 1], points[i - 1]).normalize();
            let sideVec = new THREE.Vector3().crossVectors(tangent, UP);
            if (sideVec.lengthSq() < 0.0001) sideVec.set(0, 0, 1);
            sideVec.normalize();

            const side = i % 2 === 0 ? -1 : 1;
            const primaryLen = (0.095 + Math.random() * 0.07) * scale * (1 - t * 0.72);
            const primaryDir = new THREE.Vector3()
                .copy(sideVec)
                .multiplyScalar(side * 0.55)
                .addScaledVector(tangent, 0.45)
                .addScaledVector(UP, -0.05)
                .normalize();
            const leafMat = leafMats[i % leafMats.length];

            const pEnd = new THREE.Vector3().copy(p).addScaledVector(primaryDir, primaryLen);
            const stemRHere = THREE.MathUtils.lerp(0.0025 * scale, 0.0009 * scale, taperEase(t));
            const primaryR0 = Math.max(stemRHere * 0.7, 0.0012 * scale);
            const primaryR1 = THREE.MathUtils.lerp(0.0011 * scale, 0.0004 * scale, taperEase(1));
            addTaperedSegment(pivot, p, pEnd, primaryR0, primaryR1, leafMat);

            const primaryLeaf = new THREE.Mesh(leafGeo, leafMat);
            primaryLeaf.position.copy(p).lerp(pEnd, 0.6);
            primaryLeaf.scale.set(1, (primaryLen * 0.7) / 0.055, 1);
            primaryLeaf.quaternion.setFromUnitVectors(UP, primaryDir);
            primaryLeaf.castShadow = true;
            pivot.add(primaryLeaf);

            const secCount = t < 0.55 ? 4 : (t < 0.75 ? 3 : 2);
            for (let s = 0; s < secCount; s++) {
                const st = s === 0 ? 0.28 : (s === 1 ? 0.55 : 0.8);
                const sp = new THREE.Vector3().copy(p).lerp(pEnd, st);
                const secSide = s % 2 === 0 ? -1 : 1;
                const secDir = new THREE.Vector3()
                    .copy(sideVec)
                    .multiplyScalar(secSide * side * 0.5)
                    .addScaledVector(primaryDir, 0.55)
                    .addScaledVector(UP, -0.05)
                    .normalize();
                const secLen = primaryLen * (0.16 + Math.random() * 0.08) * (1 - t * 0.62);
                const secMat = leafMats[(i + s + 1) % leafMats.length];
                const secEnd = new THREE.Vector3().copy(sp).addScaledVector(secDir, secLen);
                const secR0 = Math.max(primaryR0 * (1 - st * 0.3), 0.0004 * scale);
                const secR1 = THREE.MathUtils.lerp(secR0, 0.00006 * scale, taperEase(1));
                const secMid = new THREE.Vector3().copy(sp).lerp(secEnd, 0.8);
                const secRMid = Math.max(secR0 * 0.82, 0.00018 * scale);
                addTaperedSegment(pivot, sp, secMid, secR0, secRMid, secMat);
                addTaperedSegment(pivot, secMid, secEnd, secRMid, secR1, secMat);

                const tiny = new THREE.Mesh(tinyLeafGeo, secMat);
                tiny.position.copy(sp).lerp(secEnd, 0.58);
                tiny.scale.set(1, (secLen * 0.95) / 0.026, 1);
                tiny.quaternion.setFromUnitVectors(UP, secDir);
                tiny.castShadow = true;
                pivot.add(tiny);
            }
        }

        const tipProbe = new THREE.Object3D();
        tipProbe.position.copy(points[points.length - 1]);
        pivot.add(tipProbe);

        const attachPoints = [
            points[Math.floor(points.length * 0.36)].clone(),
            points[Math.floor(points.length * 0.58)].clone(),
            points[Math.floor(points.length * 0.74)].clone(),
        ];

        // More perpendicular takeoff from ground, then natural downward tip.
        pivot.rotation.x = -0.03 - Math.random() * 0.22;
        pivot.rotation.z = (Math.random() - 0.5) * 0.06;

        return {
            pivot,
            tipProbe,
            attachPoints,
            baseRotX: pivot.rotation.x,
            baseRotZ: pivot.rotation.z,
            phase: Math.random() * Math.PI * 2,
            swayAmp: 0.005 + Math.random() * 0.006,
            collapsed: false,
            collapse: 0,
            collapseVel: 0.012 + Math.random() * 0.01,
        };
    }

    function createHillMesh() {
        const texCanvas = document.createElement('canvas');
        texCanvas.width = 512;
        texCanvas.height = 512;
        const ctx = texCanvas.getContext('2d');
        const g = ctx.createRadialGradient(255, 255, 20, 255, 255, 230);
        g.addColorStop(0, 'rgba(178,184,176,0.14)');
        g.addColorStop(0.55, 'rgba(192,196,188,0.06)');
        g.addColorStop(1, 'rgba(210,214,206,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, texCanvas.width, texCanvas.height);

        const tex = new THREE.CanvasTexture(texCanvas);
        tex.needsUpdate = true;

        const hillGeo = new THREE.PlaneGeometry(2.0, 2.0);
        const hillMat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            depthWrite: false,
            opacity: 1,
        });

        const hill = new THREE.Mesh(hillGeo, hillMat);
        hill.rotation.x = -Math.PI / 2;
        hill.position.set(0.0, -0.018, 0.0);
        hill.receiveShadow = true;
        return hill;
    }

    function createFogVeils() {
        fogGroup = new THREE.Group();
        const fogCanvas = document.createElement('canvas');
        fogCanvas.width = 256;
        fogCanvas.height = 256;
        const ctx = fogCanvas.getContext('2d');
        const grad = ctx.createRadialGradient(128, 128, 16, 128, 128, 120);
        grad.addColorStop(0, 'rgba(255,255,255,0.22)');
        grad.addColorStop(0.45, 'rgba(245,248,246,0.09)');
        grad.addColorStop(1, 'rgba(240,244,242,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);
        const fogTex = new THREE.CanvasTexture(fogCanvas);

        for (let i = 0; i < 4; i++) {
            const mat = new THREE.SpriteMaterial({
                map: fogTex,
                transparent: true,
                opacity: 0.035 + Math.random() * 0.04,
                depthWrite: false,
                color: 0xf7faf8,
            });
            const veil = new THREE.Sprite(mat);
            const s = 0.36 + Math.random() * 0.28;
            veil.scale.set(s, s, 1);
            veil.position.set((Math.random() - 0.5) * 1.1, 0.06 + Math.random() * 0.09, (Math.random() - 0.5) * 0.9);
            fogGroup.add(veil);
            fogVeils.push({
                veil,
                baseY: veil.position.y,
                phase: Math.random() * Math.PI * 2,
                drift: 0.004 + Math.random() * 0.007,
            });
        }

        mossGroup.add(fogGroup);
    }

    function createShimmer() {
        shimmerGroup = new THREE.Group();
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = 128;
        glowCanvas.height = 128;
        const gctx = glowCanvas.getContext('2d');
        const rad = gctx.createRadialGradient(64, 64, 2, 64, 64, 64);
        rad.addColorStop(0, 'rgba(235,255,236,0.7)');
        rad.addColorStop(0.5, 'rgba(208,244,210,0.2)');
        rad.addColorStop(1, 'rgba(208,244,210,0)');
        gctx.fillStyle = rad;
        gctx.fillRect(0, 0, 128, 128);
        const glowTex = new THREE.CanvasTexture(glowCanvas);

        for (let i = 0; i < 22; i++) {
            const sm = new THREE.SpriteMaterial({
                map: glowTex,
                color: 0xeaf7ec,
                transparent: true,
                opacity: 0.065 + Math.random() * 0.06,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            });
            const dot = new THREE.Sprite(sm);
            dot.position.set((Math.random() - 0.5) * 1.25, 0.06 + Math.random() * 0.2, (Math.random() - 0.5) * 1.25);
            const s = 0.2 + Math.random() * 0.2;
            dot.scale.set(s, s, 1);
            shimmerGroup.add(dot);
            shimmerDots.push({
                dot,
                baseY: dot.position.y,
                phase: Math.random() * Math.PI * 2,
                amp: 0.004 + Math.random() * 0.009,
                twinkle: 0.02 + Math.random() * 0.028,
            });
        }
        shimmerGroup.position.set(0.0, 0, 0);
        mossGroup.add(shimmerGroup);
    }

    function createLeucobryumClump(x, z, scale) {
        const clump = new THREE.Group();
        clump.position.set(x, -0.01, z);

        const needleMat = new THREE.MeshStandardMaterial({
            color: 0xe7efe5,
            roughness: 0.88,
            metalness: 0.0,
        });
        const needleLen = 0.046 * scale;
        const needleGeo = new THREE.CylinderGeometry(0.0003 * scale, 0.00115 * scale, needleLen, 5);
        const needleCount = 43;
        for (let i = 0; i < needleCount; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * 0.038 * scale;
            const h = 0.002 + Math.random() * 0.008 * scale;
            const nx = Math.cos(a) * r;
            const nz = Math.sin(a) * r;
            const needle = new THREE.Mesh(needleGeo, needleMat);
            needle.position.set(nx, h, nz);
            const dir = new THREE.Vector3(
                nx * 0.56,
                0.006 * scale + Math.random() * 0.016 * scale,
                nz * 0.56
            ).normalize();
            needle.quaternion.setFromUnitVectors(UP, dir);
            needle.rotateX((Math.random() - 0.5) * 0.5);
            needle.rotateZ((Math.random() - 0.5) * 0.38);
            needle.castShadow = true;
            clump.add(needle);
        }

        mossGroup.add(clump);
    }

    function createLeucobryumPatch(cx, cz, scale) {
        const clumps = 7 + Math.floor(Math.random() * 3);
        for (let i = 0; i < clumps; i++) {
            const a = (i / clumps) * Math.PI * 2 + Math.random() * 1.2;
            const r = (0.022 + Math.random() * 0.028) * scale;
            createLeucobryumClump(
                cx + Math.cos(a) * r,
                cz + Math.sin(a) * r,
                scale * (0.5 + Math.random() * 0.35)
            );
        }
    }

    function createMoth() {
        const g = new THREE.Group();
        const wingMat = new THREE.MeshBasicMaterial({
            color: 0xe1ded6,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            depthWrite: false,
            depthTest: false,
        });
        function ovalWing(rx, ry) {
            const s = new THREE.Shape();
            s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false);
            return new THREE.Mesh(new THREE.ShapeGeometry(s), wingMat.clone());
        }
        const upperRx = 0.016;
        const upperRy = 0.027;
        const lowerRx = 0.012;
        const lowerRy = 0.014;
        const upperL = ovalWing(upperRx, upperRy);
        const upperR = ovalWing(upperRx, upperRy);
        const lowerL = ovalWing(lowerRx, lowerRy);
        const lowerR = ovalWing(lowerRx, lowerRy);
        const leftWing = new THREE.Group();
        const rightWing = new THREE.Group();

        upperL.position.set(-upperRx * 0.7, upperRy * 0.2, 0.001);
        lowerL.position.set(-lowerRx * 1.0, -upperRy * 0.95, 0.001);
        upperR.position.set(upperRx * 1.05, -upperRy * 0.08, -0.001);
        lowerR.position.set(lowerRx * 1.1, -upperRy * 0.95, -0.001);

        upperL.rotation.set(0.1, 0, 0.26);
        lowerL.rotation.set(0.16, 0.02, 0.62);
        upperR.rotation.set(-0.08, 0, -0.2);
        lowerR.rotation.set(-0.14, -0.02, -0.42);

        leftWing.add(upperL);
        leftWing.add(lowerL);
        rightWing.add(upperR);
        rightWing.add(lowerR);
        g.add(leftWing);
        g.add(rightWing);
        g.renderOrder = 999;

        g.rotation.set(0.05, 0.12, 0.03);
        g.scale.set(0.92, 0.92, 0.92);

        g.position.set(0.72, 0.18, -0.02);
        scene.add(g);

        moth = {
            group: g,
            wingL: [upperL, lowerL],
            wingR: [upperR, lowerR],
            leftWing,
            rightWing,
            velocity: new THREE.Vector3(0, 0, 0),
            phase: Math.random() * Math.PI * 2,
        };
        mothTarget.set(g.position.x, g.position.y, g.position.z);
    }

    function triggerScreenGlitch(screenXNorm) {
        const lineCount = 2 + Math.floor(Math.random() * 2);
        const band = 0.018;
        for (let i = 0; i < lineCount; i++) {
            screenGlitches.push({
                x: screenXNorm + (Math.random() - 0.5) * band,
                px: 0.7 + Math.random() * 0.45,
                ttl: 0.03 + Math.random() * 0.02,
                life: 0.03 + Math.random() * 0.02,
                flash: true,
            });
        }
    }

    function initMoss() {
        mossFronds.length = 0;
        const basePositions = [];

        // Irregular patch; some fronds placed so others' bases sit under their leaves.
        const baseFrondCount = 20;
        for (let i = 0; i < baseFrondCount; i++) {
            const x = (Math.random() - 0.5) * 0.64 + (Math.random() - 0.5) * 0.05;
            const z = (Math.random() - 0.5) * 0.58 + (Math.random() - 0.5) * 0.05;
            const a = Math.random() * Math.PI * 2;
            basePositions.push({ x, z });

            const frond = createFrond(0.78 + Math.random() * 0.34);
            frond.pivot.position.set(x, -0.004, z);
            frond.pivot.rotation.y = a + (Math.random() - 0.5) * 1.1;
            frond.homeY = frond.pivot.position.y;
            frond.ashSpawned = false;
            frond.growthProgress = 0;
            frond.growthDelay = 0.15 * i + Math.random() * 0.12;
            mossGroup.add(frond.pivot);
            mossFronds.push(frond);

            const childCount = Math.random() > 0.72 ? 1 : 0;
            for (let c = 0; c < childCount; c++) {
                const attach = frond.attachPoints[Math.floor(Math.random() * frond.attachPoints.length)];
                const child = createFrond((0.56 + Math.random() * 0.22) * (0.9 + (1 - attach.x / 0.7) * 0.2));
                child.pivot.position.copy(attach);
                child.pivot.position.y += -0.003 + Math.random() * 0.002;
                child.pivot.rotation.y = (Math.random() - 0.5) * 1.3;
                child.homeY = child.pivot.position.y;
                child.ashSpawned = false;
                child.growthProgress = 0;
                child.growthDelay = frond.growthDelay + 0.2 + Math.random() * 0.15;
                frond.pivot.add(child.pivot);
                mossFronds.push(child);
            }
        }

        // Short overlap fronds whose leaves sit over other fronds' bases to hide stem emergence.
        for (let i = 0; i < 9; i++) {
            const ref = basePositions[Math.floor(Math.random() * basePositions.length)];
            const x = ref.x + (Math.random() - 0.5) * 0.08;
            const z = ref.z + (Math.random() - 0.5) * 0.08;
            const a = Math.random() * Math.PI * 2;
            const frond = createFrond(0.42 + Math.random() * 0.28);
            frond.pivot.position.set(x, -0.0035, z);
            frond.pivot.rotation.y = a + (Math.random() - 0.5) * 1.4;
            frond.homeY = frond.pivot.position.y;
            frond.ashSpawned = false;
            frond.growthProgress = 0;
            frond.growthDelay = 0.4 + Math.random() * 0.5;
            mossGroup.add(frond.pivot);
            mossFronds.push(frond);
        }

        createLeucobryumPatch(-0.52, 0.28, 0.8);
        createLeucobryumPatch(0.56, -0.32, 0.75);
        createLeucobryumPatch(0.22, 0.12, 0.66);
    }

    function initScene() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0d2516);
        scene.fog = new THREE.Fog(0x0d2516, 1.8, 7.8);

        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 60);
        camera.position.set(0, 0.96, 2.1);
        camera.lookAt(0, 0.38, -0.04);

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const hemi = new THREE.HemisphereLight(0xbfd2c3, 0x0d2516, 0.8);
        scene.add(hemi);

        const key = new THREE.DirectionalLight(0xffffff, 1.1);
        key.position.set(2.2, 3.5, 2.3);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.near = 0.2;
        key.shadow.camera.far = 10;
        key.shadow.camera.left = -3;
        key.shadow.camera.right = 3;
        key.shadow.camera.top = 2.5;
        key.shadow.camera.bottom = -2.5;
        key.shadow.bias = -0.00035;
        scene.add(key);

        const fill = new THREE.DirectionalLight(0xd4e4d8, 0.5);
        fill.position.set(-1.7, 1.4, -1.2);
        scene.add(fill);

        mossGroup = new THREE.Group();
        mossGroup.position.set(0.78, -0.004, -0.12);
        mossGroup.scale.set(1.32, 1.32, 1.32);
        scene.add(mossGroup);

        hillMesh = createHillMesh();
        mossGroup.add(hillMesh);

        const catchGeo = new THREE.PlaneGeometry(2.0, 2.0);
        const catchMat = new THREE.ShadowMaterial({ opacity: 0.12 });
        shadowCatcher = new THREE.Mesh(catchGeo, catchMat);
        shadowCatcher.rotation.x = -Math.PI / 2;
        shadowCatcher.position.set(0.0, -0.017, 0.0);
        shadowCatcher.receiveShadow = true;
        mossGroup.add(shadowCatcher);

        initMoss();
        createFogVeils();
        createShimmer();
        createMoth();
        cursorPlane.constant = 0;
        scene.userData.startTime = undefined;
    }

    function resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);

        const cur = document.getElementById('cursorCanvas');
        if (cur) {
            cur.width = w;
            cur.height = h;
        }
    }

    function updateCursorTarget() {
        mouseNDC.x = (mouse.x / window.innerWidth) * 2 - 1;
        mouseNDC.y = -(mouse.y / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouseNDC, camera);

        const hit = raycaster.ray.intersectPlane(cursorPlane, cursorTarget);
        if (hit) {
            cursorTargetLocal.copy(cursorTarget);
            mossGroup.worldToLocal(cursorTargetLocal);
        } else {
            cursorTargetLocal.set(1000, 0, 1000);
        }
    }

    function updatePlants() {
        updateCursorTarget();

        const pullRadius = 0.72;
        const crumbleRadius = 0.055;

        for (const frond of mossFronds) {
            frond.tipProbe.getWorldPosition(tempWorld);
            tempLocal.copy(tempWorld);
            mossGroup.worldToLocal(tempLocal);

            const dx = cursorTargetLocal.x - tempLocal.x;
            const dz = cursorTargetLocal.z - tempLocal.z;
            const d = Math.hypot(dx, dz);
            const influence = d < pullRadius ? (1 - d / pullRadius) : 0;
            if (!frond.collapsed && d < crumbleRadius) {
                frond.collapsed = true;
                if (!frond.ashSpawned) {
                    tempWorld.copy(frond.tipProbe.getWorldPosition(new THREE.Vector3()));
                    tempWorld.project(camera);
                    const screenXNorm = tempWorld.x * 0.5 + 0.5;
                    triggerScreenGlitch(screenXNorm);
                    frond.ashSpawned = true;
                }
            }

            const baseSwayX = Math.sin(time * 0.8 + frond.phase) * frond.swayAmp;
            const baseSwayZ = Math.cos(time * 0.74 + frond.phase * 1.3) * frond.swayAmp * 0.55;

            const pullX = THREE.MathUtils.clamp(-dz * 0.3, -0.12, 0.12) * influence;
            const pullZ = THREE.MathUtils.clamp(dx * 0.3, -0.12, 0.12) * influence;

            const livingTargetX = frond.baseRotX + baseSwayX + pullX;
            const livingTargetZ = frond.baseRotZ + baseSwayZ + pullZ;
            if (frond.collapsed) {
                frond.collapse = Math.min(1, frond.collapse + frond.collapseVel * 0.35);
            }
            const collapseY = Math.min(0.0032, frond.collapse * 0.0032);

            const targetX = frond.collapsed ? frond.baseRotX : livingTargetX;
            const targetZ = frond.collapsed ? frond.baseRotZ : livingTargetZ;
            frond.pivot.rotation.x += (targetX - frond.pivot.rotation.x) * 0.07;
            frond.pivot.rotation.z += (targetZ - frond.pivot.rotation.z) * 0.07;
            const targetY = (frond.homeY ?? -0.004) - collapseY;
            frond.pivot.position.y += (targetY - frond.pivot.position.y) * 0.15;
            const flatScale = 1 - frond.collapse * 0.92;
            if (frond.collapsed) {
                frond.pivot.traverse((o) => {
                    if (o.material) {
                        if (!o.userData.origOpacity) o.userData.origOpacity = o.material.opacity !== undefined ? o.material.opacity : 1;
                        if (o.material.color && !o.userData.origColor) o.userData.origColor = o.material.color.clone();
                        o.material.transparent = true;
                        o.material.opacity = Math.max(0.32, 1 - frond.collapse * 0.76);
                        if (o.material.color && o.userData.origColor) {
                            const colorFade = Math.min(1, Math.pow(frond.collapse, 1.25));
                            o.material.color.copy(o.userData.origColor).lerp(DEAD_FROND_COLOR, colorFade);
                        }
                    }
                });
            }
            if (typeof frond.growthProgress === 'number') {
                const age = time - (scene.userData.startTime ?? time);
                if (age > frond.growthDelay) {
                    const growthAge = age - frond.growthDelay;
                    const t = Math.min(1, growthAge / 1.8);
                    frond.growthProgress = 1 - Math.pow(1 - t, 4);
                }
            }
            const gVal = typeof frond.growthProgress === 'number' ? Math.max(0.001, frond.growthProgress) : 1;
            const yScale = frond.collapsed ? Math.max(0.08, flatScale) : 1;
            frond.pivot.scale.set(gVal, gVal * yScale, gVal);
        }

        for (const s of shimmerDots) {
            s.dot.position.y = s.baseY + Math.sin(time * 0.7 + s.phase) * s.amp;
            s.dot.material.opacity = Math.max(0, s.twinkle + Math.sin(time * 2.2 + s.phase) * 0.02);
        }

        for (const f of fogVeils) {
            f.veil.position.y = f.baseY + Math.sin(time * 0.28 + f.phase) * f.drift;
            f.veil.material.opacity = 0.055 + Math.sin(time * 0.35 + f.phase) * 0.02;
        }

        if (moth) {
            mothTarget.set(
                0.72 + Math.sin(time * 0.34 + moth.phase) * 0.22 + Math.sin(time * 0.14 + moth.phase * 0.6) * 0.08,
                0.18 + Math.sin(time * 0.46 + moth.phase * 0.7) * 0.05,
                -0.02 + Math.cos(time * 0.3 + moth.phase * 1.2) * 0.14
            );

            const desired = new THREE.Vector3().subVectors(mothTarget, moth.group.position);
            moth.velocity.addScaledVector(desired, 0.0046);
            moth.velocity.multiplyScalar(0.94);
            moth.group.position.add(moth.velocity);
            const flap = Math.sin(time * 17 + moth.phase) * 0.52;
            const flutter = Math.sin(time * 32 + moth.phase * 1.7) * 0.08;
            moth.leftWing.rotation.y = 0.16 + flap;
            moth.rightWing.rotation.y = -0.16 - flap;
            for (const w of moth.wingL) {
                w.rotation.z = (w === moth.wingL[0] ? 0.15 : 0.35) + flap;
                w.rotation.x = (w === moth.wingL[0] ? 0.08 : 0.12) + flutter;
            }
            for (const w of moth.wingR) {
                w.rotation.z = (w === moth.wingR[0] ? -0.15 : -0.35) - flap;
                w.rotation.x = (w === moth.wingR[0] ? -0.06 : -0.1) - flutter;
            }
        }
    }

    function drawScreenGlitches(ctx, w, h) {
        for (let i = screenGlitches.length - 1; i >= 0; i--) {
            const g = screenGlitches[i];
            g.ttl -= 0.016;
            const x = Math.max(0, Math.min(1, g.x)) * w;
            ctx.save();
            ctx.strokeStyle = g.flash ? `rgba(248, 252, 249, ${0.38 + Math.random() * 0.32})` : 'rgba(236, 242, 238, 0.35)';
            ctx.lineWidth = g.px !== undefined ? g.px : 1;
            const segments = 4 + Math.floor(Math.random() * 4);
            for (let s = 0; s < segments; s++) {
                const y0 = Math.random() * h;
                const segLen = h * (0.05 + Math.random() * 0.16);
                ctx.beginPath();
                ctx.moveTo(x, y0);
                ctx.lineTo(x, Math.min(h, y0 + segLen));
                ctx.stroke();
            }
            ctx.restore();
            if (g.ttl <= 0) {
                screenGlitches.splice(i, 1);
            }
        }
    }

    function drawCursorOn(ctx) {
        ctx.save();
        ctx.translate(mouse.x, mouse.y);
        ctx.rotate(time * 0.0015);
        const s = 7;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.beginPath(); ctx.arc(-s * 0.28, -s * 0.18, s * 0.14, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(s * 0.28, -s * 0.18, s * 0.14, 0, Math.PI); ctx.stroke();
        ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(0, s * 0.08, s * 0.38, 0.22, Math.PI - 0.22); ctx.stroke();
        ctx.restore();
    }

    function drawCursor() {
        const cur = document.getElementById('cursorCanvas');
        if (!cur || !cur.getContext) return;
        const cctx = cur.getContext('2d');
        cctx.clearRect(0, 0, cur.width, cur.height);
        drawScreenGlitches(cctx, cur.width, cur.height);
        drawCursorOn(cctx);
    }

    function animate() {
        time = performance.now() * 0.001;
        if (scene.userData.startTime === undefined) scene.userData.startTime = time;
        mossGroup.rotation.y += 0.00075;

        updatePlants();
        drawCursor();

        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    document.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    initScene();
    resize();
    animate();
}
