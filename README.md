# The Kaleidoscope of Confirmation

An interactive, cinematic digital exhibition exploring the metaphor of the Kaleidoscope and the Seven Gifts of the Holy Spirit. Designed as a self-assembling optical phenomenon.

---

## 🚀 Live Demo & Deployment
This project is structured for zero-configuration deployment to **GitHub Pages**:
1. Create a new GitHub repository.
2. Push this folder's contents to the repository.
3. In the repository settings, navigate to **Pages** and set the source branch to `main` (root folder).
4. The site will go live at `https://<your-username>.github.io/<repo-name>/` (serving `index.html` as the default landing page).

---

## 📂 Repository Structure
*   `index.html` - The production-compiled standalone page. It contains all HTML, CSS, JS, and compressed image assets inlined for instant, offline-first performance.
*   `confirmation_index.html` - The raw source HTML layout.
*   `confirmation_index.css` - The layout, margins, and typography styling.
*   `confirmation_index.js` - The interactive engine coordinating scroll calculations, WebGL-like radial masking, ray-tracing, and Seven Gifts connectors.
*   `compile_confirmation.py` - The compilation script that compresses the high-resolution PNG source assets into highly optimized JPEGs, encodes them to base64, and inlines all code and media into `index.html`.
*   `exhibit_*.png` - The original high-resolution creative artwork assets.

---

## 🛠️ Local Development & Compilation
To modify the code or graphics, make changes to the source files (`confirmation_index.*`), and then run the compiler to output the updated `index.html`:

```bash
python compile_confirmation.py
```

*Requirements:* Python 3 with the `Pillow` library installed (`pip install Pillow`).
