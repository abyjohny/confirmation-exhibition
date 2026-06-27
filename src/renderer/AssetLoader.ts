export class AssetLoader {
  private images: Record<string, HTMLImageElement> = {};
  private loadedCount = 0;
  private totalCount = 0;
  private onProgressCallback: (progress: number) => void = () => {};
  private onCompleteCallback: () => void = () => {};

  constructor(imageUrls: Record<string, string>) {
    console.log("AssetLoader: initializing with URLs:", imageUrls);
    const entries = Object.entries(imageUrls);
    this.totalCount = entries.length;

    if (this.totalCount === 0) {
      console.log("AssetLoader: no assets to load");
      setTimeout(() => {
        this.onProgressCallback(1);
        this.onCompleteCallback();
      }, 0);
      return;
    }

    entries.forEach(([key, url]) => {
      console.log(`AssetLoader: starting load for [${key}] = "${url}"`);
      const img = new Image();
      img.onload = () => {
        console.log(`AssetLoader: loaded [${key}]`);
        this.onItemLoaded(key, img);
      };
      img.onerror = (e) => {
        console.error(`AssetLoader: failed to load [${key}] = "${url}"`, e);
        this.onItemLoaded(key, img); // load fallback to continue app
      };
      img.src = url;
    });
  }

  private onItemLoaded(key: string, img: HTMLImageElement) {
    this.images[key] = img;
    this.loadedCount++;
    this.onProgressCallback(this.loadedCount / this.totalCount);

    if (this.loadedCount === this.totalCount) {
      console.log(`AssetLoader: all assets loaded. Triggering onCompleteCallback. Callback is:`, this.onCompleteCallback);
      this.onCompleteCallback();
    }
  }

  public onProgress(callback: (progress: number) => void) {
    this.onProgressCallback = callback;
    if (this.totalCount > 0) {
      callback(this.loadedCount / this.totalCount);
    }
  }

  public onComplete(callback: () => void) {
    console.log("AssetLoader: registering onComplete callback");
    this.onCompleteCallback = callback;
    if (this.loadedCount === this.totalCount) {
      console.log("AssetLoader: triggering onComplete callback immediately during registration");
      callback();
    }
  }

  public getImage(key: string): HTMLImageElement {
    return this.images[key];
  }
}
