/**
 * The Kaleidoscope of Confirmation - Experience Engine
 * Art-directed coordinates, protected composition zones, and ray-tracing bounds.
 */

(function() {
    // --- Configuration & State ---
    const CONFIG = {
        maxProgress: 5.0,        // Clamped scroll progress (0.0 to 5.0)
        lerpFactor: 0.05,        // Inertial weight for smoothing
        particleCount: 80,       // Number of shards in State 5
        rayCount: 8              // Number of reflected rays in State 3
    };

    let state = {
        scrollProgressTarget: 0,
        scrollProgress: 0,
        targetMouseX: 0,         // Normalized mouse coords (-1 to 1)
        targetMouseY: 0,
        mouseX: 0,               // Smoothed mouse coords
        mouseY: 0,
        clientX: window.innerWidth / 2, // Screen space coords for custom cursor
        clientY: window.innerHeight / 2,
        currentClientX: window.innerWidth / 2,
        currentClientY: window.innerHeight / 2,
        time: 0,
        activeState: 1
    };

    // --- Load Exhibit Images in JS ---
    const images = {
        kaleidoscope: new Image(),
        soulEye: new Image(),
        dove: new Image()
    };
    images.kaleidoscope.src = 'exhibit_kaleidoscope.png';
    images.soulEye.src = 'exhibit_soul_eye.png';
    images.dove.src = 'exhibit_dove.png';

    // --- DOM Elements ---
    const canvas = document.getElementById('exhibition-canvas');
    const ctx = canvas.getContext('2d');
    
    // Create Offscreen Buffer Canvas for the Source Slice (60 degrees)
    const offscreenCanvas = document.createElement('canvas');
    const octx = offscreenCanvas.getContext('2d');

    // Reuseable temp canvas for radial image masking
    const tempCanvas = document.createElement('canvas');
    const tctx = tempCanvas.getContext('2d');

    const lumenPointer = document.getElementById('lumen-pointer');
    const lumenGlow = document.getElementById('lumen-glow');
    const hudCircle = document.querySelector('.progress-ring__circle');
    const hudNum = document.getElementById('scroll-state-num');
    const overlayStates = document.querySelectorAll('.overlay-state');
    const displacementMap = document.querySelector('feDisplacementMap');
    const turbulence = document.querySelector('feTurbulence');

    // Gift nodes and descriptions
    const giftNodes = document.querySelectorAll('.gift-node');
    const giftDescText = document.getElementById('gift-desc-text');

    const GIFT_DESCRIPTIONS = {
        "1": "Allows us to see things as God sees them, understanding the true value of life's experiences.",
        "2": "Gives us a deeper insight into the truths of faith, helping us to grasp the meaning of God's Word.",
        "3": "Helps us to make correct, moral choices in everyday situations, guided by the Holy Spirit.",
        "4": "Strengthens us to stand up for our faith and face difficulties with fortitude and trust in God.",
        "5": "Enables us to recognize the hand of God at work in our lives and the beauty of creation.",
        "6": "Inspires us to love God as our Father and show deep reverence for all sacred things and others.",
        "7": "Fills us with a sacred awe and wonder of God's presence, leading us to respect His love and avoid sin."
    };

    // --- Helper Functions ---
    const lerp = (start, end, amt) => (1 - amt) * start + amt * end;
    
    function getPlateauOpacity(val, start, peakStart, peakEnd, end) {
        if (val < start || val > end) return 0;
        if (val >= peakStart && val <= peakEnd) return 1;
        if (val < peakStart) {
            return (val - start) / (peakStart - start);
        } else {
            return (end - val) / (end - peakEnd);
        }
    }
    
    // --- Canvas Masked Image Drawer ---
    function drawMaskedImage(targetCtx, img, x, y, width, height, opacity, rotateAngle = 0) {
        if (!img.complete || img.naturalWidth === 0 || opacity <= 0) return;
        
        // Resize temp canvas if dimensions changed
        if (tempCanvas.width !== width || tempCanvas.height !== height) {
            tempCanvas.width = width;
            tempCanvas.height = height;
        }
        
        tctx.clearRect(0, 0, width, height);
        tctx.drawImage(img, 0, 0, width, height);
        
        // Create radial gradient mask
        const cx = width / 2;
        const cy = height / 2;
        const maskRadius = Math.min(width, height) / 2;
        const mask = tctx.createRadialGradient(cx, cy, maskRadius * 0.25, cx, cy, maskRadius * 0.95);
        mask.addColorStop(0, 'rgba(0,0,0,1)');
        mask.addColorStop(0.7, 'rgba(0,0,0,0.85)');
        mask.addColorStop(1, 'rgba(0,0,0,0)');
        
        // Apply mask
        tctx.globalCompositeOperation = 'destination-in';
        tctx.fillStyle = mask;
        tctx.fillRect(0, 0, width, height);
        tctx.globalCompositeOperation = 'source-over';
        
        // Draw centered on target coordinates with rotation and opacity
        targetCtx.save();
        targetCtx.globalAlpha = opacity;
        targetCtx.translate(x, y);
        if (rotateAngle !== 0) {
            targetCtx.rotate(rotateAngle);
        }
        targetCtx.drawImage(tempCanvas, -width / 2, -height / 2);
        targetCtx.restore();
    }

    // --- HUD & Overlay Updates ---
    function updateHUD() {
        const circumference = 163.36;
        const progressFraction = state.scrollProgress / CONFIG.maxProgress;
        const offset = circumference - progressFraction * circumference;
        hudCircle.style.strokeDashoffset = offset;
        
        const newState = Math.min(6, Math.max(1, Math.floor(state.scrollProgress + 0.5) + 1));
        if (state.activeState !== newState) {
            state.activeState = newState;
            hudNum.innerText = "0" + newState;
            
            // Toggle overlay transitions
            overlayStates.forEach((overlay, idx) => {
                if (idx + 1 === newState) {
                    overlay.classList.add('active');
                } else {
                    overlay.classList.remove('active');
                }
            });

            if (newState === 5) {
                // Trigger sequential node hover glow
                giftNodes.forEach((node, idx) => {
                    setTimeout(() => {
                        if (state.activeState === 5) node.classList.add('active');
                    }, idx * 120);
                });
            } else {
                giftNodes.forEach(n => n.classList.remove('active'));
            }
        }
    }

    // --- Interactive Gift Node Actions ---
    giftNodes.forEach(node => {
        const giftId = node.getAttribute('data-gift');
        
        const showDesc = () => {
            giftNodes.forEach(n => n.classList.remove('active'));
            node.classList.add('active');
            
            giftDescText.style.opacity = 0;
            setTimeout(() => {
                giftDescText.innerText = GIFT_DESCRIPTIONS[giftId];
                giftDescText.style.opacity = 1;
            }, 200);
        };

        node.addEventListener('mouseenter', showDesc);
        node.addEventListener('click', showDesc);
    });

    document.querySelector('.gifts-row').addEventListener('mouseleave', () => {
        giftNodes.forEach(n => n.classList.remove('active'));
        giftDescText.style.opacity = 0;
        setTimeout(() => {
            giftDescText.innerText = "Hover or click a gift's icon above to reveal its vision-transforming power.";
            giftDescText.style.opacity = 1;
        }, 200);
    });

    // --- State 3 Polar Bouncing Rays Setup ---
    const rays = [];
    for (let i = 0; i < CONFIG.rayCount; i++) {
        rays.push({
            r: 20 + Math.random() * 60,
            phi: (Math.random() * 0.4 - 0.2), // radians, within [-30 deg, 30 deg]
            vr: 1.2 + Math.random() * 1.5,
            vphi: (Math.random() * 0.012 - 0.006),
            color: i % 2 === 0 ? 'rgba(255, 215, 0, 0.5)' : 'rgba(255, 253, 249, 0.35)',
            history: []
        });
    }

    // --- State 5 Symmetrical Floating Shards Setup ---
    const shards = [];
    function generateShards() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const minDim = Math.min(width, height);
        
        shards.length = 0;
        for (let i = 0; i < CONFIG.particleCount; i++) {
            const ring = i % 8;
            const radius = (ring + 1) * (minDim * 0.045);
            const maxAngle = (25 * Math.PI) / 180;
            const step = (maxAngle * 2) / (CONFIG.particleCount / 8);
            const indexInRing = Math.floor(i / 8);
            const angle = -maxAngle + (indexInRing * step) + (ring * 0.015);
            
            shards.push({
                targetX: radius * Math.cos(angle),
                targetY: radius * Math.sin(angle),
                size: 2 + Math.random() * 4,
                color: ring % 2 === 0 ? 'rgba(255, 215, 0, 0.55)' : 'rgba(255, 253, 249, 0.4)',
                angleOffset: Math.random() * Math.PI * 2
            });
        }
    }

    // --- Window Resize ---
    function resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        canvas.width = w;
        canvas.height = h;
        offscreenCanvas.width = w;
        offscreenCanvas.height = h;
        
        generateShards();
    }
    window.addEventListener('resize', resize);

    // --- Input Bindings ---
    window.addEventListener('wheel', (e) => {
        state.scrollProgressTarget += e.deltaY * 0.001;
        state.scrollProgressTarget = Math.max(0, Math.min(CONFIG.maxProgress, state.scrollProgressTarget));
    }, { passive: true });

    let touchStartY = 0;
    window.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        const deltaY = touchStartY - e.touches[0].clientY;
        touchStartY = e.touches[0].clientY;
        state.scrollProgressTarget += deltaY * 0.005;
        state.scrollProgressTarget = Math.max(0, Math.min(CONFIG.maxProgress, state.scrollProgressTarget));
    }, { passive: true });

    window.addEventListener('mousemove', (e) => {
        state.clientX = e.clientX;
        state.clientY = e.clientY;
        state.targetMouseX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
        state.targetMouseY = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    }, { passive: true });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
            state.scrollProgressTarget = Math.min(CONFIG.maxProgress, state.scrollProgressTarget + 0.25);
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') {
            state.scrollProgressTarget = Math.max(0, state.scrollProgressTarget - 0.25);
        }
    });

    // --- Offscreen Source Slice (Symmetry element) ---
    function drawWedgeSource(cx, cy, maxR, imgW) {
        octx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        octx.save();
        octx.translate(cx, cy);

        // State 1 & 2: Kaleidoscope Overlay Reflections
        if (state.scrollProgress < 2.0) {
            let opacity = 0;
            if (state.scrollProgress <= 1.0) {
                opacity = state.scrollProgress * 0.35;
            } else {
                opacity = (2.0 - state.scrollProgress) * 0.35;
            }

            if (opacity > 0) {
                octx.save();
                octx.rotate(state.mouseX * 0.12);
                octx.strokeStyle = `rgba(255, 215, 0, ${opacity * 0.25})`;
                octx.lineWidth = 1;
                for (let r = 0; r < 5; r++) {
                    octx.beginPath();
                    octx.arc(0, 0, 40 * (r + 1), -Math.PI / 6, Math.PI / 6);
                    octx.stroke();
                }
                octx.restore();
            }
        }

        // State 3: Bouncing Rays (Constrained to the inside of the Soul Eye iris halo)
        if (state.scrollProgress > 1.0 && state.scrollProgress < 3.0) {
            let opacity = 0;
            if (state.scrollProgress <= 2.0) {
                opacity = state.scrollProgress - 1.0;
            } else {
                opacity = 3.0 - state.scrollProgress;
            }

            const activeLimitRadius = imgW * 0.45; // Boundaries terminate exactly on the iris edge

            rays.forEach(p => {
                p.r += p.vr;
                p.phi += p.vphi + (state.mouseY * 0.0005);
                
                const limit = Math.PI / 6;
                if (p.phi > limit) {
                    p.phi = Math.PI / 3 - p.phi;
                    p.vphi = -p.vphi;
                } else if (p.phi < -limit) {
                    p.phi = -Math.PI / 3 - p.phi;
                    p.vphi = -p.vphi;
                }
                
                // Wrap and reset inside if it escapes the iris boundary
                if (p.r > activeLimitRadius) {
                    p.r = 15;
                    p.history = [];
                }
                
                const rx = p.r * Math.cos(p.phi);
                const ry = p.r * Math.sin(p.phi);
                
                p.history.push({ x: rx, y: ry });
                if (p.history.length > 20) p.history.shift();
                
                if (p.history.length > 1) {
                    octx.beginPath();
                    octx.moveTo(p.history[0].x, p.history[0].y);
                    for (let h = 1; h < p.history.length; h++) {
                        octx.lineTo(p.history[h].x, p.history[h].y);
                    }
                    octx.strokeStyle = p.color.replace(')', `, ${opacity * 0.65})`).replace('rgb', 'rgba');
                    octx.lineWidth = 1;
                    octx.stroke();
                }
            });
        }

        // State 5: Symmetrical floating shards
        if (state.scrollProgress > 3.5 && state.scrollProgress < 5.0) {
            const opacity = getPlateauOpacity(state.scrollProgress, 3.5, 3.7, 4.2, 4.45);

            shards.forEach((p, idx) => {
                let x = p.targetX;
                let y = p.targetY;
                
                const waveSpeed = 0.003;
                const waveX = Math.sin(state.time * waveSpeed + p.targetY * 0.02 + state.mouseX * 1.5) * 15;
                const waveY = Math.cos(state.time * waveSpeed + p.targetX * 0.02 + state.mouseY * 1.5) * 15;
                x += waveX;
                y += waveY;

                octx.save();
                octx.translate(x, y);
                octx.rotate((state.time * 0.00012) + p.angleOffset);
                octx.fillStyle = p.color.replace(')', `, ${opacity * 0.45})`).replace('rgb', 'rgba');
                
                octx.beginPath();
                const size = p.size;
                if (idx % 2 === 0) {
                    octx.moveTo(0, -size);
                    octx.lineTo(size, size);
                    octx.lineTo(-size, size);
                } else {
                    octx.moveTo(0, -size);
                    octx.lineTo(size * 0.6, 0);
                    octx.lineTo(0, size);
                    octx.lineTo(-size * 0.6, 0);
                }
                octx.closePath();
                octx.fill();
                octx.restore();
            });
        }

        octx.restore();
    }

    // --- Main Renderer Loop ---
    function render(timestamp) {
        state.time = timestamp;
        
        // Interpolate Scroll and Mouse
        state.scrollProgress = lerp(state.scrollProgress, state.scrollProgressTarget, CONFIG.lerpFactor);
        state.mouseX = lerp(state.mouseX, state.targetMouseX, CONFIG.lerpFactor);
        state.mouseY = lerp(state.mouseY, state.targetMouseY, CONFIG.lerpFactor);
        
        state.currentClientX = lerp(state.currentClientX, state.clientX, 0.15);
        state.currentClientY = lerp(state.currentClientY, state.clientY, 0.15);
        
        // Position custom cursor
        lumenPointer.style.left = `${state.currentClientX}px`;
        lumenPointer.style.top = `${state.currentClientY}px`;
        lumenGlow.style.left = `${state.currentClientX}px`;
        lumenGlow.style.top = `${state.currentClientY}px`;

        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const maxR = Math.max(w, h) * 1.3;

        // Size metrics for the visuals
        const cylinderW = Math.min(w, h) * 0.68;
        const irisW = Math.min(w, h) * 0.60;

        // Draw offscreen wedge source (using iris width for radial ray bounds)
        drawWedgeSource(cx, cy, maxR, irisW);

        // --- BACKGROUND AND COLOR SPILL FADES ---
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, w, h);

        // State 4 Dove Golden/Amber spill (constrained to center sphere)
        if (state.scrollProgress > 2.5 && state.scrollProgress < 4.5) {
            const doveProgress = Math.max(0, 1 - Math.abs(state.scrollProgress - 3.5));
            const goldSpill = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.6);
            goldSpill.addColorStop(0, `rgba(255, 170, 0, ${0.11 * doveProgress})`);
            goldSpill.addColorStop(0.5, `rgba(255, 110, 0, ${0.03 * doveProgress})`);
            goldSpill.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = goldSpill;
            ctx.fillRect(0, 0, w, h);
        }

        // State 5 Crimson spill (behind gifts grid)
        if (state.scrollProgress > 3.5 && state.scrollProgress < 5.0) {
            const crimsonProgress = Math.max(0, 1 - Math.abs(state.scrollProgress - 4.5) * 2);
            const crimsonSpill = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.65);
            crimsonSpill.addColorStop(0, `rgba(139, 0, 0, ${0.07 * crimsonProgress})`);
            crimsonSpill.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = crimsonSpill;
            ctx.fillRect(0, 0, w, h);
        }

        // State 6 Celestial Horizon
        let state6Opacity = 0;
        if (state.scrollProgress > 4.5) {
            state6Opacity = (state.scrollProgress - 4.5) / 0.5;
        }

        if (state6Opacity > 0) {
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#020205');
            grad.addColorStop(0.6, '#08060f');
            grad.addColorStop(1, '#1b1220');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            for (let i = 0; i < 20; i++) {
                const starX = (Math.sin(i * 123) * 0.5 + 0.5) * w;
                const starY = (Math.cos(i * 456) * 0.5 + 0.5) * h * 0.8;
                const pulse = 0.5 + 0.5 * Math.sin(state.time * 0.0008 + i);
                ctx.beginPath();
                ctx.arc(starX, starY, 1 * pulse, 0, Math.PI * 2);
                ctx.fill();
            }

            const horizonGrad = ctx.createRadialGradient(cx, h * 0.9, 0, cx, h * 0.9, w * 0.5);
            horizonGrad.addColorStop(0, `rgba(255, 215, 0, ${0.16 * state6Opacity})`);
            horizonGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
            ctx.fillStyle = horizonGrad;
            ctx.beginPath();
            ctx.ellipse(cx, h * 0.9, w * 0.7, h * 0.25, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- DRAW MASKED ARTWORK ON CANVAS IN PROTECTED ZONES ---

        // State 1 & 2: Kaleidoscope Cylinder (Asymmetrical on Right 65%)
        if (state.scrollProgress < 2.5) {
            const opacity = getPlateauOpacity(state.scrollProgress, 0.0, 0.3, 1.2, 1.4) * 0.95;

            if (opacity > 0) {
                // Coordinate shifted further right to prevent text overlaps
                const imgX = w * 0.74 + state.mouseX * 25;
                const imgY = cy + state.mouseY * 20;
                const scaleVal = 0.96 + (opacity / 0.95) * 0.04;
                const tiltAngle = -0.05 + state.mouseX * 0.04;
                
                drawMaskedImage(ctx, images.kaleidoscope, imgX, imgY, cylinderW * scaleVal, cylinderW * scaleVal, opacity, tiltAngle);

                // Volumetric beam sweeps across but dissolves completely before hitting the left column
                if (state.scrollProgress > 0.8) {
                    const beamOpacity = Math.max(0, 1 - Math.abs(state.scrollProgress - 1.25) * 1.5) * opacity;
                    if (beamOpacity > 0) {
                        ctx.save();
                        ctx.globalCompositeOperation = 'screen';
                        const startX = imgX - cylinderW * 0.25;
                        const startY = imgY;
                        
                        // Fades out at w * 0.45 (safe margin of empty space before left column text at 35%)
                        const endX = w * 0.45;
                        const endY = cy;

                        const beamGrad = ctx.createLinearGradient(startX, startY, endX, endY);
                        beamGrad.addColorStop(0, `rgba(255, 215, 0, ${0.42 * beamOpacity})`);
                        beamGrad.addColorStop(0.4, `rgba(255, 180, 0, ${0.15 * beamOpacity})`);
                        beamGrad.addColorStop(1, 'rgba(255, 180, 0, 0)'); // 100% transparent
                        
                        ctx.strokeStyle = beamGrad;
                        ctx.lineWidth = 35;
                        ctx.lineCap = 'round';
                        ctx.beginPath();
                        ctx.moveTo(startX, startY);
                        ctx.lineTo(endX, endY);
                        ctx.stroke();

                        ctx.lineWidth = 4;
                        ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * beamOpacity})`;
                        ctx.stroke();
                        ctx.restore();
                    }
                }
            }
        }

        // State 3: Soul Eye Lens (Asymmetrical on Right 65%)
        if (state.scrollProgress > 1.5 && state.scrollProgress < 3.5) {
            const opacity = getPlateauOpacity(state.scrollProgress, 1.6, 1.8, 2.2, 2.4);

            if (opacity > 0) {
                const imgX = w * 0.74 + state.mouseX * 20;
                const imgY = cy + state.mouseY * 15;
                const scaleVal = 0.96 + opacity * 0.04;
                const spinAngle = state.time * 0.00015;
                
                drawMaskedImage(ctx, images.soulEye, imgX, imgY, irisW * scaleVal, irisW * scaleVal, opacity, spinAngle);
            }
        }

        // State 4: Holy Spirit Dove (Centered composition with Lower Third Text)
        if (state.scrollProgress > 2.5 && state.scrollProgress < 4.5) {
            const opacity = getPlateauOpacity(state.scrollProgress, 2.6, 2.8, 3.2, 3.45);

            if (opacity > 0) {
                const imgW = Math.min(w, h) * 0.85;
                const imgX = cx + state.mouseX * 35;
                const imgY = cy * 0.88 + state.mouseY * 25; // Shifted slightly higher to create negative space for bottom text
                const scaleVal = 0.96 + opacity * 0.04;
                
                drawMaskedImage(ctx, images.dove, imgX, imgY, imgW * scaleVal, imgW * scaleVal, opacity);

                // Volumetric rays shooting outward from dove core
                ctx.save();
                ctx.translate(imgX, imgY);
                ctx.rotate(state.time * 0.00008);
                ctx.globalCompositeOperation = 'screen';
                
                const rayCount = 18;
                for (let r = 0; r < rayCount; r++) {
                    const angle = (r * Math.PI * 2) / rayCount;
                    const rGrad = ctx.createLinearGradient(0, 0, maxR * Math.cos(angle), maxR * Math.sin(angle));
                    rGrad.addColorStop(0, `rgba(255, 215, 0, ${0.15 * opacity})`);
                    rGrad.addColorStop(0.4, `rgba(255, 180, 0, ${0.06 * opacity})`);
                    rGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    
                    ctx.fillStyle = rGrad;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(maxR * Math.cos(angle - 0.07), maxR * Math.sin(angle - 0.07));
                    ctx.lineTo(maxR * Math.cos(angle + 0.07), maxR * Math.sin(angle + 0.07));
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();
            }
        }

        // --- DRAW SYMMETRICAL KALEIDOSCOPE REFLECTIONS ---
        ctx.save();
        
        // State 5 SVG displacement shader activate
        if (state.scrollProgress > 4.0 && state.scrollProgress < 5.0) {
            const meltVal = state.scrollProgress - 4.0;
            canvas.style.filter = `url(#liquid-oil)`;
            if (displacementMap) {
                displacementMap.setAttribute('scale', (meltVal * 35).toFixed(2));
            }
            if (turbulence) {
                const freq = 0.015 + 0.004 * Math.sin(state.time * 0.0005);
                turbulence.setAttribute('baseFrequency', freq.toFixed(5));
            }
        } else {
            canvas.style.filter = 'none';
        }

        const scaleVal = 1.0 + Math.sin(state.time * 0.00045) * 0.022;
        ctx.globalAlpha = 1 - state6Opacity;

        // Position center of reflections according to current state layout
        let rx = cx;
        if (state.scrollProgress < 3.5) {
            rx = w * 0.74; // Centered on the right-hand visual exhibits
        }

        for (let i = 0; i < 6; i++) {
            ctx.save();
            ctx.translate(rx, cy);
            
            ctx.scale(scaleVal, scaleVal);
            ctx.rotate(i * Math.PI / 3);
            
            if (i % 2 === 1) {
                ctx.scale(1, -1);
            }
            
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(maxR * Math.cos(-Math.PI / 6), maxR * Math.sin(-Math.PI / 6));
            ctx.lineTo(maxR * Math.cos(Math.PI / 6), maxR * Math.sin(Math.PI / 6));
            ctx.closePath();
            ctx.clip();
            
            ctx.drawImage(offscreenCanvas, -rx, -cy);
            ctx.restore();
        }
        ctx.restore();

        // --- STATE 5: DYNAMIC CONNECTOR LIGHT STREAMS ---
        if (state.activeState === 5) {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            
            const giftsOpacity = getPlateauOpacity(state.scrollProgress, 3.5, 3.7, 4.2, 4.45);
            
            giftNodes.forEach((node, idx) => {
                // Terminate exactly at the top border of the icon circle container
                const iconContainer = node.querySelector('.gift-icon-container');
                if (iconContainer) {
                    const rect = iconContainer.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        const targetX = rect.left + rect.width / 2;
                        const targetY = rect.top; // Stop exactly at top border, avoiding visual overlap
                        
                        const originX = cx + state.mouseX * 30;
                        const originY = cy * 0.45 + state.mouseY * 20; // raised origin center
                        
                        // Draw thin golden connector line
                        const streamGrad = ctx.createLinearGradient(originX, originY, targetX, targetY);
                        streamGrad.addColorStop(0, `rgba(255, 215, 0, ${0.30 * giftsOpacity})`);
                        streamGrad.addColorStop(0.8, `rgba(255, 180, 0, ${0.10 * giftsOpacity})`);
                        streamGrad.addColorStop(1, 'rgba(255, 180, 0, 0)');
                        
                        ctx.strokeStyle = streamGrad;
                        ctx.lineWidth = 1.5; // Thin elegant thread
                        ctx.beginPath();
                        ctx.moveTo(originX, originY);
                        ctx.lineTo(targetX, targetY);
                        ctx.stroke();

                        // Glowing spark traveling down the line
                        const travelSpeed = 0.002;
                        const progress = (state.time * travelSpeed + idx * 0.14) % 1.0;
                        const sparkX = lerp(originX, targetX, progress);
                        const sparkY = lerp(originY, targetY, progress);
                        
                        const sparkGlow = ctx.createRadialGradient(sparkX, sparkY, 0, sparkX, sparkY, 10);
                        sparkGlow.addColorStop(0, `rgba(255, 255, 255, ${0.80 * giftsOpacity})`);
                        sparkGlow.addColorStop(0.3, `rgba(255, 215, 0, ${0.5 * giftsOpacity})`);
                        sparkGlow.addColorStop(1, 'rgba(255, 215, 0, 0)');
                        
                        ctx.fillStyle = sparkGlow;
                        ctx.beginPath();
                        ctx.arc(sparkX, sparkY, 10, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            });
            ctx.restore();
        }

        // State 6: Draw rotating overlay grid ("The lens of grace")
        if (state6Opacity > 0) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(state.time * 0.00004);
            ctx.strokeStyle = `rgba(255, 253, 249, ${0.06 * state6Opacity})`;
            ctx.lineWidth = 0.5;
            
            ctx.beginPath();
            for (let a = 0; a < 12; a++) {
                const angle = (a * Math.PI) / 6;
                ctx.moveTo(0, 0);
                ctx.lineTo(maxR * Math.cos(angle), maxR * Math.sin(angle));
            }
            for (let r = 0; r < 4; r++) {
                ctx.arc(0, 0, 120 * (r + 1), 0, Math.PI * 2);
            }
            ctx.stroke();
            ctx.restore();
        }

        // Update progress indicators and triggers
        updateHUD();

        requestAnimationFrame(render);
    }

    // --- Initialization ---
    resize();
    requestAnimationFrame(render);

})();
