export class ShaderPipeline {
  /**
   * Compiles a GLSL shader.
   */
  public static compileShader(
    gl: WebGLRenderingContext,
    source: string,
    type: number
  ): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error(`Failed to create shader of type: ${type}`);
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${log}\nSource: ${source}`);
    }

    return shader;
  }

  /**
   * Links vertex and fragment shaders into a WebGLProgram.
   */
  public static createProgram(
    gl: WebGLRenderingContext,
    vertexSource: string,
    fragmentSource: string
  ): WebGLProgram {
    const vertexShader = ShaderPipeline.compileShader(gl, vertexSource, gl.VERTEX_SHADER);
    const fragmentShader = ShaderPipeline.compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);

    const program = gl.createProgram();
    if (!program) {
      throw new Error('Failed to create WebGLProgram');
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program linking failed: ${log}`);
    }

    return program;
  }
}
