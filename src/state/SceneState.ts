export interface SceneState {
  scrollProgress: number;          // Normalised: 0.0 to 5.0
  activeScene: number;             // Active State: 1 to 6
  loading: boolean;                // Is preloader active
  loadProgress: number;            // Loading progress percentage (0.0 to 1.0)
  lightIntensity: number;          // Volumetric lighting multiplier
  kaleidoscopeStrength: number;    // Kaleidoscope blend (0.0 to 1.0)
  overlayOpacity: number;          // Typography text opacity
  currentArtwork: number;          // Track visual elements (0: none, 1: kaleidoscope, etc)
  transitionProgress: number;      // Scroll between states
  mouseX: number;                  // Smoothed mouse coord X (-1 to 1)
  mouseY: number;                  // Smoothed mouse coord Y (-1 to 1)
  time: number;                    // Running ticker time (ms)
}

export function createDefaultState(): SceneState {
  return {
    scrollProgress: 0.0,
    activeScene: 1,
    loading: true,
    loadProgress: 0.0,
    lightIntensity: 0.0,
    kaleidoscopeStrength: 0.0,
    overlayOpacity: 0.0,
    currentArtwork: 0,
    transitionProgress: 0.0,
    mouseX: 0.0,
    mouseY: 0.0,
    time: 0.0
  };
}
