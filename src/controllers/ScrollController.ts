import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { SceneController } from './SceneController';

export class ScrollController {
  private lenis!: Lenis;
  private sceneController: SceneController;

  constructor(sceneController: SceneController) {
    this.sceneController = sceneController;
    if (typeof window !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
      this.initLenis();
      this.initScrollTimeline();
    }
  }

  private initLenis() {
    this.lenis = new Lenis({
      duration: 1.6,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // premium ease out
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.1,
      touchMultiplier: 1.8,
    });

    // Synchronize Lenis scrolling with GSAP ScrollTrigger
    this.lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      this.lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);
  }

  private initScrollTimeline() {
    const state = this.sceneController.state;

    // 1. Create a Master Scroll-Linked Timeline
    const mainTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: '.scroll-container',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.2, // Smooth follow scrub (1.2s delay for inertial feel)
      }
    });

    // Animate scrollProgress from 0.0 to 5.0 linearly with scroll
    mainTimeline.to(state, {
      scrollProgress: 5.0,
      ease: 'none',
      duration: 5.0
    }, 0);

    // 2. Animate Shader parameters along the timeline
    
    // Kaleidoscope strength peak at State 1 & 2
    mainTimeline.to(state, {
      kaleidoscopeStrength: 1.0,
      ease: 'power2.inOut',
      duration: 0.8
    }, 0);

    mainTimeline.to(state, {
      kaleidoscopeStrength: 0.0,
      ease: 'power2.inOut',
      duration: 0.8
    }, 1.4);

    // Light beam intensity peaks at State 3 and fades
    mainTimeline.to(state, {
      lightIntensity: 1.0,
      ease: 'sine.inOut',
      duration: 0.6
    }, 1.2);

    mainTimeline.to(state, {
      lightIntensity: 0.0,
      ease: 'sine.inOut',
      duration: 0.6
    }, 2.4);

    // 3. Animate DOM Typography elements (Cinematic transitions with safe peak zones)
    const overlayStates = document.querySelectorAll('.overlay-state');

    overlayStates.forEach((overlay, idx) => {
      const title = overlay.querySelector('.intro-title, .concept-title, .scripture-text, .gifts-headline, .revelation-headline');
      const text = overlay.querySelector('.intro-text, .concept-desc, .gifts-row, .gift-node, .revelation-accent');

      if (idx === 0) {
        // State 1: Active on load, fades out as we scroll away towards State 2
        gsap.set(overlay, { opacity: 1, visibility: 'visible' });
        if (title) gsap.set(title, { y: 0, opacity: 1, letterSpacing: '0.22em' });
        if (text) gsap.set(text, { y: 0, opacity: 1 });

        // Fade/Slide out
        mainTimeline.to(overlay, {
          opacity: 0,
          visibility: 'hidden',
          ease: 'power2.inOut',
          duration: 0.3
        }, 0.5);

        if (title) {
          mainTimeline.to(title, { y: -20, opacity: 0, ease: 'power2.inOut', duration: 0.3 }, 0.5);
        }
        if (text) {
          mainTimeline.to(text, { y: -15, opacity: 0, ease: 'power2.inOut', duration: 0.3 }, 0.5);
        }

      } else if (idx < 5) {
        // States 2 to 5: Fade in before their peak, and fade out after their peak
        const startOffset = idx * 1.0 - 0.5; // e.g. 0.5 for state 2
        const endOffset = idx * 1.0 + 0.2;   // e.g. 1.2 for state 2

        gsap.set(overlay, { opacity: 0, visibility: 'hidden' });
        if (title) gsap.set(title, { y: 20, opacity: 0, letterSpacing: '0.15em' });
        if (text) gsap.set(text, { y: 15, opacity: 0 });

        // Fade/Slide in
        mainTimeline.to(overlay, {
          opacity: 1,
          visibility: 'visible',
          ease: 'power2.out',
          duration: 0.3
        }, startOffset);

        if (title) {
          mainTimeline.to(title, { y: 0, opacity: 1, letterSpacing: '0.22em', ease: 'power3.out', duration: 0.35 }, startOffset);
        }
        if (text) {
          mainTimeline.to(text, { y: 0, opacity: 1, ease: 'power3.out', duration: 0.35 }, startOffset + 0.05);
        }

        // Fade/Slide out
        mainTimeline.to(overlay, {
          opacity: 0,
          visibility: 'hidden',
          ease: 'power2.in',
          duration: 0.3
        }, endOffset);

        if (title) {
          mainTimeline.to(title, { y: -20, opacity: 0, ease: 'power3.in', duration: 0.3 }, endOffset);
        }
        if (text) {
          mainTimeline.to(text, { y: -15, opacity: 0, ease: 'power3.in', duration: 0.3 }, endOffset);
        }

      } else {
        // State 6: Revelation (Fades in near end and remains active)
        gsap.set(overlay, { opacity: 0, visibility: 'hidden' });
        if (title) gsap.set(title, { y: 20, opacity: 0, letterSpacing: '0.15em' });
        if (text) gsap.set(text, { y: 15, opacity: 0 });

        // Fade/Slide in
        mainTimeline.to(overlay, {
          opacity: 1,
          visibility: 'visible',
          ease: 'power2.out',
          duration: 0.3
        }, 4.5);

        if (title) {
          mainTimeline.to(title, { y: 0, opacity: 1, letterSpacing: '0.22em', ease: 'power3.out', duration: 0.35 }, 4.5);
        }
        if (text) {
          mainTimeline.to(text, { y: 0, opacity: 1, ease: 'power3.out', duration: 0.35 }, 4.6);
        }
      }
    });
  }

  public updateResize() {
    ScrollTrigger.refresh();
  }

  public destroy() {
    if (this.lenis) {
      this.lenis.destroy();
    }
    ScrollTrigger.getAll().forEach(t => t.kill());
  }
}
