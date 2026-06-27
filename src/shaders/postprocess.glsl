precision mediump float;

varying vec2 v_texCoord;

uniform sampler2D u_texture;
uniform float u_time;
uniform float u_kaleidoscopeStrength;
uniform float u_segments;
uniform vec2 u_center;
uniform float u_angleOffset;
uniform float u_chromaticStrength;
uniform float u_distortionStrength;
uniform float u_noiseStrength;
uniform float u_vignetteStrength;
uniform float u_displacementStrength;
uniform float u_aspectRatio;

// Simple pseudo-random generator for noise/film grain
float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 tc = v_texCoord;

    // 1. Liquid wave displacement (GPU replacement for SVG liquid-oil)
    if (u_displacementStrength > 0.0) {
        float waveSpeed = u_time * 0.002;
        float waveX = sin(tc.y * 12.0 + waveSpeed) * 0.008 * u_displacementStrength;
        float waveY = cos(tc.x * 12.0 + waveSpeed) * 0.008 * u_displacementStrength;
        tc += vec2(waveX, waveY);
    }

    // 2. Barrel lens distortion
    if (u_distortionStrength != 0.0) {
        vec2 distUv = tc - vec2(0.5);
        float r2 = dot(distUv, distUv);
        tc = vec2(0.5) + distUv * (1.0 + u_distortionStrength * r2);
    }

    // 3. Symmetrical Kaleidoscope reflection in polar coordinates
    vec2 uv = tc - u_center;
    
    // Correct aspect ratio for circular calculations
    uv.x *= u_aspectRatio;
    
    float r = length(uv);
    float theta = atan(uv.y, uv.x);
    
    if (u_kaleidoscopeStrength > 0.0) {
        float pi2 = 6.28318530718;
        
        // Normalize theta to [0, 2*PI]
        theta = mod(theta - u_angleOffset, pi2);
        if (theta < 0.0) theta += pi2;
        
        float segmentAngle = pi2 / u_segments;
        float segment = floor(theta / segmentAngle);
        float localTheta = theta - segment * segmentAngle;
        
        // Symmetrical reflection
        if (localTheta > segmentAngle * 0.5) {
            localTheta = segmentAngle - localTheta;
        }
        
        theta = localTheta + u_angleOffset;
        uv = vec2(r * cos(theta), r * sin(theta));
    }
    
    // Restore aspect ratio mapping
    uv.x /= u_aspectRatio;
    vec2 sampledUv = uv + u_center;

    // Clamp coordinates to avoid sampling wrapping artifacts
    sampledUv = clamp(sampledUv, 0.001, 0.999);

    // 4. Chromatic Aberration (RGB Channel Split)
    vec4 finalColor;
    if (u_chromaticStrength > 0.0) {
        vec2 dir = sampledUv - vec2(0.5);
        float dist = length(dir);
        vec2 offset = dir * (dist * 0.012 * u_chromaticStrength);
        
        finalColor.r = texture2D(u_texture, sampledUv - offset).r;
        finalColor.g = texture2D(u_texture, sampledUv).g;
        finalColor.b = texture2D(u_texture, sampledUv + offset).b;
        finalColor.a = texture2D(u_texture, sampledUv).a;
    } else {
        finalColor = texture2D(u_texture, sampledUv);
    }

    // 5. Film Grain / Procedural Noise
    if (u_noiseStrength > 0.0) {
        float noise = (rand(sampledUv + sin(u_time * 0.01)) - 0.5) * 2.0;
        finalColor.rgb += vec3(noise * 0.06 * u_noiseStrength);
    }

    // 6. Soft Vignette (Cinematic border shadows)
    if (u_vignetteStrength > 0.0) {
        vec2 d = tc - vec2(0.5);
        float dist = length(d);
        float vignette = smoothstep(0.8, 0.35, dist);
        finalColor.rgb = mix(finalColor.rgb, finalColor.rgb * vignette, u_vignetteStrength);
    }

    gl_FragColor = finalColor;
}
