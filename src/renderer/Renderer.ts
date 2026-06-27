import { ShaderPipeline } from './ShaderPipeline';
import { AssetLoader } from './AssetLoader';
import type { SceneState } from '../state/SceneState';
import vertexSource from '../shaders/vertex.glsl';
import fragmentSource from '../shaders/fragment.glsl';
import postprocessSource from '../shaders/postprocess.glsl';

// 2D Matrix helpers for WebGL Clip Space rendering
class Matrix3 {
  static projection(width: number, height: number): number[] {
    return [
      2 / width, 0, 0,
      0, -2 / height, 0,
      -1, 1, 1
    ];
  }

  static multiply(a: number[], b: number[]): number[] {
    const a00 = a[0], a01 = a[1], a02 = a[2];
    const a10 = a[3], a11 = a[4], a12 = a[5];
    const a20 = a[6], a21 = a[7], a22 = a[8];
    const b00 = b[0], b01 = b[1], b02 = b[2];
    const b10 = b[3], b11 = b[4], b12 = b[5];
    const b20 = b[6], b21 = b[7], b22 = b[8];
    return [
      b00 * a00 + b01 * a10 + b02 * a20,
      b00 * a01 + b01 * a11 + b02 * a21,
      b00 * a02 + b01 * a12 + b02 * a22,
      b10 * a00 + b11 * a10 + b12 * a20,
      b10 * a01 + b11 * a11 + b12 * a21,
      b10 * a02 + b11 * a12 + b12 * a22,
      b20 * a00 + b21 * a10 + b22 * a20,
      b20 * a01 + b21 * a11 + b22 * a21,
      b20 * a02 + b21 * a12 + b22 * a22
    ];
  }

  static translate(m: number[], tx: number, ty: number): number[] {
    return Matrix3.multiply(m, [
      1, 0, 0,
      0, 1, 0,
      tx, ty, 1
    ]);
  }

  static rotate(m: number[], angleInRadians: number): number[] {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    return Matrix3.multiply(m, [
      c, s, 0,
      -s, c, 0,
      0, 0, 1
    ]);
  }

  static scale(m: number[], sx: number, sy: number): number[] {
    return Matrix3.multiply(m, [
      sx, 0, 0,
      0, sy, 0,
      0, 0, 1
    ]);
  }
}

interface Ray {
  r: number;
  phi: number;
  vr: number;
  vphi: number;
  color: [number, number, number, number]; // RGBA
  history: { x: number; y: number }[];
}

interface Shard {
  targetX: number;
  targetY: number;
  size: number;
  color: [number, number, number, number];
  angleOffset: number;
  shape: 'triangle' | 'diamond';
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private assetLoader: AssetLoader;

  private artworkProgram!: WebGLProgram;
  private postProgram!: WebGLProgram;

  private textures: Record<string, WebGLTexture> = {};
  private whiteTexture!: WebGLTexture;

  private quadBuffer!: WebGLBuffer;
  private fbo!: WebGLFramebuffer;
  private fboTexture!: WebGLTexture;

  // Particle sets
  private rays: Ray[] = [];
  private shards: Shard[] = [];

  constructor(canvas: HTMLCanvasElement, assetLoader: AssetLoader) {
    this.canvas = canvas;
    this.assetLoader = assetLoader;

    const glContext = canvas.getContext('webgl', { alpha: false, antialias: true });
    if (!glContext) {
      throw new Error('WebGL context is not supported by your browser.');
    }
    this.gl = glContext;

    this.initShaders();
    this.initBuffers();
    this.initTextures();
    this.initFbo();
    this.setupParticles();

    this.resize();
  }

  private initShaders() {
    this.artworkProgram = ShaderPipeline.createProgram(this.gl, vertexSource, fragmentSource);
    this.postProgram = ShaderPipeline.createProgram(this.gl, vertexSource, postprocessSource);
  }

  private initBuffers() {
    // 2D Quad layout: positions (X, Y) and texture coordinates (U, V)
    const quadVertices = new Float32Array([
      // X,  Y,    U, V
      -0.5, -0.5,  0.0, 0.0,
       0.5, -0.5,  1.0, 0.0,
      -0.5,  0.5,  0.0, 1.0,
       0.5,  0.5,  1.0, 1.0,
    ]);

    this.quadBuffer = this.gl.createBuffer()!;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, quadVertices, this.gl.STATIC_DRAW);
  }

  private initTextures() {
    // Helper to upload image to GPU texture
    const createGLTexture = (img: HTMLImageElement) => {
      const tex = this.gl.createTexture()!;
      this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, img);
      
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      return tex;
    };

    // Load available artwork images from assetLoader
    const artworkKeys = ['kaleidoscope', 'soulEye', 'dove'];
    artworkKeys.forEach(key => {
      const img = this.assetLoader.getImage(key);
      if (img) {
        this.textures[key] = createGLTexture(img);
      }
    });

    // Create 1x1 white texture for solid color drawing
    this.whiteTexture = this.gl.createTexture()!;
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.whiteTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      1,
      1,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255])
    );
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
  }

  private initFbo() {
    this.fbo = this.gl.createFramebuffer()!;
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo);

    this.fboTexture = this.gl.createTexture()!;
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.fboTexture);
    
    // Size is configured in resize()
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.canvas.width,
      this.canvas.height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      null
    );

    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      this.fboTexture,
      0
    );

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  private setupParticles() {
    // Volumetric Rays (State 3)
    this.rays = [];
    for (let i = 0; i < 8; i++) {
      this.rays.push({
        r: 20 + Math.random() * 60,
        phi: Math.random() * 0.4 - 0.2, // within [-11deg, 11deg]
        vr: 1.2 + Math.random() * 1.5,
        vphi: Math.random() * 0.012 - 0.006,
        color: i % 2 === 0 ? [1.0, 0.84, 0.0, 0.5] : [1.0, 0.99, 0.98, 0.35],
        history: []
      });
    }

    // Shards (State 5)
    this.shards = [];
    const minDim = Math.min(window.innerWidth, window.innerHeight);
    for (let i = 0; i < 80; i++) {
      const ring = i % 8;
      const radius = (ring + 1) * (minDim * 0.045);
      const maxAngle = (25 * Math.PI) / 180;
      const step = (maxAngle * 2) / (80 / 8);
      const indexInRing = Math.floor(i / 8);
      const angle = -maxAngle + (indexInRing * step) + (ring * 0.015);

      this.shards.push({
        targetX: radius * Math.cos(angle),
        targetY: radius * Math.sin(angle),
        size: 2 + Math.random() * 4,
        color: ring % 2 === 0 ? [1.0, 0.84, 0.0, 0.55] : [1.0, 0.99, 0.98, 0.4],
        angleOffset: Math.random() * Math.PI * 2,
        shape: i % 2 === 0 ? 'triangle' : 'diamond'
      });
    }
  }

  public resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = w;
    this.canvas.height = h;

    this.gl.viewport(0, 0, w, h);

    // Resize FBO texture
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.fboTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      w,
      h,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      null
    );

    // Update coordinates of shards dynamically
    const minDim = Math.min(w, h);
    this.shards.forEach((shard, i) => {
      const ring = i % 8;
      const radius = (ring + 1) * (minDim * 0.045);
      const maxAngle = (25 * Math.PI) / 180;
      const step = (maxAngle * 2) / 10;
      const indexInRing = Math.floor(i / 8);
      const angle = -maxAngle + (indexInRing * step) + (ring * 0.015);
      shard.targetX = radius * Math.cos(angle);
      shard.targetY = radius * Math.sin(angle);
    });
  }

  /**
   * Helper to draw a textured quad using the standard program
   */
  private drawQuad(
    texture: WebGLTexture,
    matrix: number[],
    opacity: number,
    color: [number, number, number, number] = [1, 1, 1, 1],
    maskStrength: number = 0.0,
    maskRadius: number = 0.5
  ) {
    this.gl.useProgram(this.artworkProgram);

    // Bind Attributes
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);

    const a_position = this.gl.getAttribLocation(this.artworkProgram, 'a_position');
    const a_texCoord = this.gl.getAttribLocation(this.artworkProgram, 'a_texCoord');

    this.gl.enableVertexAttribArray(a_position);
    this.gl.vertexAttribPointer(a_position, 2, this.gl.FLOAT, false, 16, 0);

    this.gl.enableVertexAttribArray(a_texCoord);
    this.gl.vertexAttribPointer(a_texCoord, 2, this.gl.FLOAT, false, 16, 8);

    // Bind Uniforms
    const u_matrix = this.gl.getUniformLocation(this.artworkProgram, 'u_matrix');
    const u_opacity = this.gl.getUniformLocation(this.artworkProgram, 'u_opacity');
    const u_maskStrength = this.gl.getUniformLocation(this.artworkProgram, 'u_maskStrength');
    const u_maskRadius = this.gl.getUniformLocation(this.artworkProgram, 'u_maskRadius');
    const u_color = this.gl.getUniformLocation(this.artworkProgram, 'u_color'); // If shader supports u_color

    this.gl.uniformMatrix3fv(u_matrix, false, matrix);
    this.gl.uniform1f(u_opacity, opacity);
    this.gl.uniform1f(u_maskStrength, maskStrength);
    this.gl.uniform1f(u_maskRadius, maskRadius);
    
    if (u_color) {
      this.gl.uniform4fv(u_color, color);
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    // Draw
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  private drawSolidQuad(
    matrix: number[],
    color: [number, number, number, number]
  ) {
    this.drawQuad(this.whiteTexture, matrix, color[3], color, 0.0);
  }

  private drawVolumetricBeam(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    width: number,
    opacity: number,
    color: [number, number, number, number]
  ) {
    // Draw volumetric beam by calculating quad points and drawing them
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const angle = Math.atan2(dy, dx);
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    let matrix = Matrix3.projection(this.canvas.width, this.canvas.height);
    matrix = Matrix3.translate(matrix, midX, midY);
    matrix = Matrix3.rotate(matrix, angle);
    matrix = Matrix3.scale(matrix, len, width);

    // Render beam with radial mask representing volumetric fade out
    this.drawQuad(this.whiteTexture, matrix, opacity, color, 1.0, 0.45);
  }

  private getPlateauOpacity(val: number, start: number, peakStart: number, peakEnd: number, end: number): number {
    if (val < start || val > end) return 0;
    if (val >= peakStart && val <= peakEnd) return 1;
    if (val < peakStart) {
      return (val - start) / (peakStart - start);
    } else {
      return (end - val) / (end - peakEnd);
    }
  }

  public render(state: SceneState) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.max(w, h) * 1.3;

    // Dimensions matching prototype
    const cylinderW = Math.min(w, h) * 0.68;
    const irisW = Math.min(w, h) * 0.60;

    // Bind Framebuffer for the pre-effects composition
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo);

    this.gl.clearColor(0.02, 0.02, 0.02, 1.0); // #050505
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // Enable basic alpha blending
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    // --- BACKGROUND GRADIENT GLOWS ---
    // State 4 Dove Golden/Amber spill
    if (state.scrollProgress > 2.5 && state.scrollProgress < 4.5) {
      const doveProgress = Math.max(0, 1 - Math.abs(state.scrollProgress - 3.5));
      const size = Math.max(w, h) * 1.2;
      let matrix = Matrix3.projection(w, h);
      matrix = Matrix3.translate(matrix, cx, cy);
      matrix = Matrix3.scale(matrix, size, size);
      // Amber glow
      this.drawQuad(this.whiteTexture, matrix, 0.11 * doveProgress, [1.0, 0.55, 0.0, 0.11 * doveProgress], 1.0, 0.45);
    }

    // State 5 Crimson spill
    if (state.scrollProgress > 3.5 && state.scrollProgress < 5.0) {
      const crimsonProgress = Math.max(0, 1 - Math.abs(state.scrollProgress - 4.5) * 2);
      const size = Math.max(w, h) * 1.3;
      let matrix = Matrix3.projection(w, h);
      matrix = Matrix3.translate(matrix, cx, cy);
      matrix = Matrix3.scale(matrix, size, size);
      // Crimson glow
      this.drawQuad(this.whiteTexture, matrix, 0.07 * crimsonProgress, [0.55, 0.0, 0.0, 0.07 * crimsonProgress], 1.0, 0.45);
    }

    // --- DRAW ACTIVE ARTWORK IMAGES ---

    // State 1 & 2: Kaleidoscope Cylinder
    if (state.scrollProgress < 2.5) {
      const opacity = this.getPlateauOpacity(state.scrollProgress, 0.0, 0.3, 1.2, 1.4) * 0.95;
      if (opacity > 0 && this.textures.kaleidoscope) {
        const imgX = w * 0.74 + state.mouseX * 25;
        const imgY = cy + state.mouseY * 20;
        const scaleVal = 0.96 + (opacity / 0.95) * 0.04;
        const tiltAngle = -0.05 + state.mouseX * 0.04;

        let matrix = Matrix3.projection(w, h);
        matrix = Matrix3.translate(matrix, imgX, imgY);
        matrix = Matrix3.rotate(matrix, tiltAngle);
        matrix = Matrix3.scale(matrix, cylinderW * scaleVal, cylinderW * scaleVal);

        this.drawQuad(this.textures.kaleidoscope, matrix, opacity, [1,1,1,1], 1.0, 0.45);

        // Volumetric beams
        if (state.scrollProgress > 0.8) {
          const beamOpacity = Math.max(0, 1 - Math.abs(state.scrollProgress - 1.25) * 1.5) * opacity;
          if (beamOpacity > 0) {
            const startX = imgX - cylinderW * 0.25;
            const startY = imgY;
            const endX = w * 0.45;
            const endY = cy;

            // Golden beam
            this.drawVolumetricBeam(startX, startY, endX, endY, 35, beamOpacity * 0.42, [1.0, 0.84, 0.0, 1.0]);
            // White core beam
            this.drawVolumetricBeam(startX, startY, endX, endY, 4, beamOpacity * 0.5, [1.0, 1.0, 1.0, 1.0]);
          }
        }
      }
    }

    // State 3: Soul Eye Lens
    if (state.scrollProgress > 1.5 && state.scrollProgress < 3.5) {
      const opacity = this.getPlateauOpacity(state.scrollProgress, 1.6, 1.8, 2.2, 2.4);
      if (opacity > 0 && this.textures.soulEye) {
        const imgX = w * 0.74 + state.mouseX * 20;
        const imgY = cy + state.mouseY * 15;
        const scaleVal = 0.96 + opacity * 0.04;
        const spinAngle = state.time * 0.00015;

        let matrix = Matrix3.projection(w, h);
        matrix = Matrix3.translate(matrix, imgX, imgY);
        matrix = Matrix3.rotate(matrix, spinAngle);
        matrix = Matrix3.scale(matrix, irisW * scaleVal, irisW * scaleVal);

        this.drawQuad(this.textures.soulEye, matrix, opacity, [1,1,1,1], 1.0, 0.45);
      }
    }

    // State 4: Holy Spirit Dove
    if (state.scrollProgress > 2.5 && state.scrollProgress < 4.5) {
      const opacity = this.getPlateauOpacity(state.scrollProgress, 2.6, 2.8, 3.2, 3.45);
      if (opacity > 0 && this.textures.dove) {
        const imgW = Math.min(w, h) * 0.85;
        const imgX = cx + state.mouseX * 35;
        const imgY = cy * 0.88 + state.mouseY * 25; // Shifted up for text space
        const scaleVal = 0.96 + opacity * 0.04;

        let matrix = Matrix3.projection(w, h);
        matrix = Matrix3.translate(matrix, imgX, imgY);
        matrix = Matrix3.scale(matrix, imgW * scaleVal, imgW * scaleVal);

        this.drawQuad(this.textures.dove, matrix, opacity, [1,1,1,1], 1.0, 0.45);

        // Volumetric ray beams sweeping outward
        const rayCount = 18;
        const spin = state.time * 0.00008;
        for (let r = 0; r < rayCount; r++) {
          const angle = (r * Math.PI * 2) / rayCount + spin;
          const beamEndX = imgX + maxR * Math.cos(angle);
          const beamEndY = imgY + maxR * Math.sin(angle);
          this.drawVolumetricBeam(imgX, imgY, beamEndX, beamEndY, 40, opacity * 0.15, [1.0, 0.84, 0.0, 1.0]);
        }
      }
    }

    // --- DRAW SYMMETRICAL REFLECTION DECORATIONS ---
    // Background reflections centered relative to state layout
    const rx = state.scrollProgress < 3.5 ? w * 0.74 : cx;
    const scaleVal = 1.0 + Math.sin(state.time * 0.00045) * 0.022;

    // State 1 & 2: Circles
    if (state.scrollProgress < 2.0) {
      let opacity = 0;
      if (state.scrollProgress <= 1.0) {
        opacity = state.scrollProgress * 0.35;
      } else {
        opacity = (2.0 - state.scrollProgress) * 0.35;
      }

      if (opacity > 0) {
        const ringRot = state.mouseX * 0.12;
        for (let i = 0; i < 6; i++) {
          let matrix = Matrix3.projection(w, h);
          matrix = Matrix3.translate(matrix, rx, cy);
          matrix = Matrix3.scale(matrix, scaleVal, scaleVal);
          matrix = Matrix3.rotate(matrix, (i * Math.PI) / 3 + ringRot);
          if (i % 2 === 1) {
            matrix = Matrix3.scale(matrix, 1, -1);
          }

          // Draw concentric arcs (thin rectangles)
          for (let r = 0; r < 5; r++) {
            const rad = 40 * (r + 1);
            let arcMat = Matrix3.translate(matrix, rad, 0);
            arcMat = Matrix3.scale(arcMat, 2, rad * 0.5); // Wedge arc representations
            this.drawSolidQuad(arcMat, [1.0, 0.84, 0.0, opacity * 0.25]);
          }
        }
      }
    }

    // State 3: Bouncing Rays (Constrained to Soul Eye iris radius)
    if (state.scrollProgress > 1.0 && state.scrollProgress < 3.0) {
      let opacity = 0;
      if (state.scrollProgress <= 2.0) {
        opacity = state.scrollProgress - 1.0;
      } else {
        opacity = 3.0 - state.scrollProgress;
      }

      const activeLimitRadius = irisW * 0.45;

      // Update rays inside wedge
      this.rays.forEach(p => {
        p.r += p.vr;
        p.phi += p.vphi + (state.mouseY * 0.0005);

        const limit = Math.PI / 6; // 30 degrees wedge
        if (p.phi > limit) {
          p.phi = Math.PI / 3 - p.phi;
          p.vphi = -p.vphi;
        } else if (p.phi < -limit) {
          p.phi = -Math.PI / 3 - p.phi;
          p.vphi = -p.vphi;
        }

        if (p.r > activeLimitRadius) {
          p.r = 15;
          p.history = [];
        }

        const rx = p.r * Math.cos(p.phi);
        const ry = p.r * Math.sin(p.phi);

        p.history.push({ x: rx, y: ry });
        if (p.history.length > 15) p.history.shift();
      });

      // Draw reflected rays
      for (let i = 0; i < 6; i++) {
        let matrix = Matrix3.projection(w, h);
        matrix = Matrix3.translate(matrix, rx, cy);
        matrix = Matrix3.scale(matrix, scaleVal, scaleVal);
        matrix = Matrix3.rotate(matrix, (i * Math.PI) / 3);
        if (i % 2 === 1) {
          matrix = Matrix3.scale(matrix, 1, -1);
        }

        // Draw ray trails
        this.rays.forEach(p => {
          if (p.history.length > 1) {
            for (let h = 1; h < p.history.length; h++) {
              const start = p.history[h - 1];
              const end = p.history[h];
              this.drawVolumetricBeam(
                start.x,
                start.y,
                end.x,
                end.y,
                1.5,
                opacity * 0.65 * (h / p.history.length),
                [p.color[0], p.color[1], p.color[2], p.color[3]]
              );
            }
          }
        });
      }
    }



    // --- STATE 6: CELESTIAL STARS & ROTATING LENS GRID ---
    let state6Opacity = 0;
    if (state.scrollProgress > 4.5) {
      state6Opacity = (state.scrollProgress - 4.5) / 0.5;
    }

    if (state6Opacity > 0) {
      // Linear gradient representation: draw top-to-bottom background quad
      let bgMat = Matrix3.projection(w, h);
      bgMat = Matrix3.translate(bgMat, cx, cy);
      bgMat = Matrix3.scale(bgMat, w, h);
      // Dark space color
      this.drawSolidQuad(bgMat, [0.03, 0.02, 0.06, state6Opacity * 0.9]);

      // Star particles
      for (let i = 0; i < 20; i++) {
        const starX = (Math.sin(i * 123) * 0.5 + 0.5) * w;
        const starY = (Math.cos(i * 456) * 0.5 + 0.5) * h * 0.8;
        const pulse = 0.5 + 0.5 * Math.sin(state.time * 0.0008 + i);

        let starMat = Matrix3.projection(w, h);
        starMat = Matrix3.translate(starMat, starX, starY);
        starMat = Matrix3.scale(starMat, 2 * pulse, 2 * pulse);
        this.drawSolidQuad(starMat, [1, 1, 1, state6Opacity * 0.8]);
      }

      // Golden horizon ellipse
      let horizonMat = Matrix3.projection(w, h);
      horizonMat = Matrix3.translate(horizonMat, cx, h * 0.9);
      horizonMat = Matrix3.scale(horizonMat, w * 1.4, h * 0.5);
      this.drawQuad(this.whiteTexture, horizonMat, state6Opacity * 0.16, [1.0, 0.84, 0.0, state6Opacity * 0.16], 1.0, 0.5);

      // Rotating Lens of Grace Grid
      for (let r = 0; r < 4; r++) {
        const rad = 120 * (r + 1);
        let ringMat = Matrix3.projection(w, h);
        ringMat = Matrix3.translate(ringMat, cx, cy);
        ringMat = Matrix3.rotate(ringMat, state.time * 0.00004);
        
        // Draw 12 spoke lines representing segments
        for (let a = 0; a < 12; a++) {
          const angle = (a * Math.PI) / 6;
          this.drawVolumetricBeam(
            0, 0,
            maxR * Math.cos(angle), maxR * Math.sin(angle),
            0.5,
            0.06 * state6Opacity,
            [1.0, 0.99, 0.98, 1.0]
          );
        }
      }
    }

    // Unbind Framebuffer
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    // Clear Canvas for final output
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // --- FINAL POST-PROCESSING SHADER PASS ---
    this.gl.useProgram(this.postProgram);

    // Bind full-screen quad vertices
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
    const a_position = this.gl.getAttribLocation(this.postProgram, 'a_position');
    const a_texCoord = this.gl.getAttribLocation(this.postProgram, 'a_texCoord');

    this.gl.enableVertexAttribArray(a_position);
    this.gl.vertexAttribPointer(a_position, 2, this.gl.FLOAT, false, 16, 0);

    this.gl.enableVertexAttribArray(a_texCoord);
    this.gl.vertexAttribPointer(a_texCoord, 2, this.gl.FLOAT, false, 16, 8);

    // Configure Post-Processing Uniforms
    const u_texture = this.gl.getUniformLocation(this.postProgram, 'u_texture');
    const u_time = this.gl.getUniformLocation(this.postProgram, 'u_time');
    const u_kaleidoscopeStrength = this.gl.getUniformLocation(this.postProgram, 'u_kaleidoscopeStrength');
    const u_segments = this.gl.getUniformLocation(this.postProgram, 'u_segments');
    const u_center = this.gl.getUniformLocation(this.postProgram, 'u_center');
    const u_angleOffset = this.gl.getUniformLocation(this.postProgram, 'u_angleOffset');
    const u_chromaticStrength = this.gl.getUniformLocation(this.postProgram, 'u_chromaticStrength');
    const u_distortionStrength = this.gl.getUniformLocation(this.postProgram, 'u_distortionStrength');
    const u_noiseStrength = this.gl.getUniformLocation(this.postProgram, 'u_noiseStrength');
    const u_vignetteStrength = this.gl.getUniformLocation(this.postProgram, 'u_vignetteStrength');
    const u_displacementStrength = this.gl.getUniformLocation(this.postProgram, 'u_displacementStrength');
    const u_aspectRatio = this.gl.getUniformLocation(this.postProgram, 'u_aspectRatio');

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.fboTexture);
    this.gl.uniform1i(u_texture, 0);

    this.gl.uniform1f(u_time, state.time);
    this.gl.uniform1f(u_kaleidoscopeStrength, state.kaleidoscopeStrength);
    this.gl.uniform1f(u_segments, 6.0); // 6-way symmetry

    // Set reflection center in normalized UV coordinates [0.0 to 1.0]
    // In state < 3.5, center is rx = w * 0.74, so UV.x = 0.74
    const uCenterX = state.scrollProgress < 3.5 ? 0.74 : 0.5;
    this.gl.uniform2f(u_center, uCenterX, 0.5);

    // Dynamic rotation offset driven by mouse position and scroll
    const angleRot = (state.time * 0.00004) + (state.mouseX * 0.12);
    this.gl.uniform1f(u_angleOffset, angleRot);

    // Interpolated effect strengths based on scroll progress
    this.gl.uniform1f(u_chromaticStrength, state.scrollProgress < 4.0 ? 0.4 : 1.2 * (state.scrollProgress - 3.8));
    this.gl.uniform1f(u_distortionStrength, state.scrollProgress > 4.0 ? 0.15 * (state.scrollProgress - 4.0) : 0.0);
    this.gl.uniform1f(u_noiseStrength, 0.5); // Constant film grain
    this.gl.uniform1f(u_vignetteStrength, 0.65); // Soft border vignette

    // Displacement strength (State 5 oil transition)
    let dispStrength = 0.0;
    if (state.scrollProgress > 4.0 && state.scrollProgress < 5.0) {
      dispStrength = (state.scrollProgress - 4.0) * 1.5;
    }
    this.gl.uniform1f(u_displacementStrength, dispStrength);

    this.gl.uniform1f(u_aspectRatio, w / h);

    // Render Full-Screen Quad to Screen
    let identity = [
      2, 0, 0,
      0, 2, 0,
      0, 0, 1
    ];
    let u_matrix_post = this.gl.getUniformLocation(this.postProgram, 'u_matrix');
    if (u_matrix_post) {
      this.gl.uniformMatrix3fv(u_matrix_post, false, identity);
    }

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }
}
