attribute vec2 a_position;
attribute vec2 a_texCoord;

varying vec2 v_texCoord;

uniform mat3 u_matrix;

void main() {
    vec3 projected = u_matrix * vec3(a_position, 1.0);
    gl_Position = vec4(projected.xy, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
