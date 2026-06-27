import type { SceneState } from '../state/SceneState';
import { createDefaultState } from '../state/SceneState';
import type { Renderer } from '../renderer/Renderer';

export class SceneController {
  public state: SceneState;
  private renderer?: Renderer;
  private rafId: number = 0;
  private targetMouseX = 0;
  private targetMouseY = 0;

  private onSceneChangeCallbacks: ((sceneNum: number) => void)[] = [];

  constructor() {
    this.state = createDefaultState();
    this.setupMouseListeners();
  }

  public setRenderer(renderer: Renderer) {
    this.renderer = renderer;
  }

  private setupMouseListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('mousemove', (e) => {
      this.targetMouseX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      this.targetMouseY = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    }, { passive: true });
  }

  public registerSceneChangeListener(callback: (sceneNum: number) => void) {
    this.onSceneChangeCallbacks.push(callback);
    // Trigger immediately with current scene
    callback(this.state.activeScene);
  }

  public startLoop() {
    const tick = (timestamp: number) => {
      this.state.time = timestamp;

      // Lerp mouse coordinates
      this.state.mouseX = this.state.mouseX + (this.targetMouseX - this.state.mouseX) * 0.05;
      this.state.mouseY = this.state.mouseY + (this.targetMouseY - this.state.mouseY) * 0.05;

      // Calculate active scene number: scrollProgress is 0.0 to 5.0, mapping to scene 1 to 6
      const newScene = Math.min(6, Math.max(1, Math.floor(this.state.scrollProgress + 0.5) + 1));
      if (newScene !== this.state.activeScene) {
        this.state.activeScene = newScene;
        this.onSceneChangeCallbacks.forEach(cb => cb(newScene));
      }

      // Render frame
      if (this.renderer && !this.state.loading) {
        this.renderer.render(this.state);
      }

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  public stopLoop() {
    if (typeof window !== 'undefined') {
      cancelAnimationFrame(this.rafId);
    }
  }
}
