precision mediump float;

varying vec2 v_texCoord;

uniform sampler2D u_texture;
uniform float u_opacity;
uniform float u_maskStrength;
uniform float u_maskRadius;
uniform vec4 u_color;

void main() {
    vec4 color = texture2D(u_texture, v_texCoord) * u_color;
    
    if (u_maskStrength > 0.0) {
        vec2 center = vec2(0.5, 0.5);
        float dist = length(v_texCoord - center);
        // Soft radial gradient fade towards edges
        float mask = smoothstep(u_maskRadius, u_maskRadius * 0.25, dist);
        color.a *= mix(1.0, mask, u_maskStrength);
    }
    
    color.a *= u_opacity;
    
    if (color.a <= 0.0) {
        discard;
    }
    
    gl_FragColor = color;
}
