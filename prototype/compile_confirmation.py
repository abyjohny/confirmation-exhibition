import os
import base64
from PIL import Image

def compress_image(src_path, dst_path, width=800, height=None):
    print(f"Compressing {src_path} to {dst_path}...")
    if not os.path.exists(src_path):
        print(f"ERROR: {src_path} does not exist!")
        return False
        
    img = Image.open(src_path)
    
    # Preserve transparency or composite onto dark background
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        bg = Image.new("RGBA", img.size, (5, 5, 5, 255)) # match dark background
        bg.paste(img, mask=img.convert('RGBA'))
        img = bg.convert('RGB')
    else:
        img = img.convert('RGB')
        
    orig_w, orig_h = img.size
    
    if height is None:
        # Calculate aspect ratio
        ratio = width / orig_w
        height = int(orig_h * ratio)
        
    img = img.resize((width, height), Image.Resampling.LANCZOS)
    img.save(dst_path, "JPEG", quality=85, optimize=True)
    print(f"Image compressed successfully to size {width}x{height}!")
    return True

def get_base64_uri(file_path, mime_type):
    with open(file_path, "rb") as f:
        encoded_string = base64.b64encode(f.read()).decode('utf-8')
    return f"data:{mime_type};base64,{encoded_string}"

def compile_all():
    workspace = r"d:\presentation"
    
    # Temp files for compression
    kaleidoscope_temp = os.path.join(workspace, "temp_kaleidoscope.jpg")
    soul_eye_temp = os.path.join(workspace, "temp_soul_eye.jpg")
    dove_temp = os.path.join(workspace, "temp_dove.jpg")
    
    # 1. Compress image assets
    compress_image(os.path.join(workspace, "exhibit_kaleidoscope.png"), kaleidoscope_temp, width=900)
    compress_image(os.path.join(workspace, "exhibit_soul_eye.png"), soul_eye_temp, width=600)
    compress_image(os.path.join(workspace, "exhibit_dove.png"), dove_temp, width=800)
    
    # 2. Encode to Base64
    print("Encoding assets to Base64...")
    kaleidoscope_b64 = get_base64_uri(kaleidoscope_temp, "image/jpeg")
    soul_eye_b64 = get_base64_uri(soul_eye_temp, "image/jpeg")
    dove_b64 = get_base64_uri(dove_temp, "image/jpeg")
    
    # 3. Read CSS and JS files
    css_path = os.path.join(workspace, "confirmation_index.css")
    js_path = os.path.join(workspace, "confirmation_index.js")
    
    with open(css_path, "r", encoding="utf-8") as f:
        css_content = f.read()
        
    with open(js_path, "r", encoding="utf-8") as f:
        js_content = f.read()
        
    # 4. Read HTML template
    html_template_path = os.path.join(workspace, "confirmation_index.html")
    with open(html_template_path, "r", encoding="utf-8") as f:
        html_content = f.read()
        
    # 5. Inline CSS, JS, and Base64 images
    html_compiled = html_content.replace(
        '<link rel="stylesheet" href="confirmation_index.css">',
        f'<style>\n{css_content}\n</style>'
    ).replace(
        '<script src="confirmation_index.js"></script>',
        f'<script>\n{js_content}\n</script>'
    ).replace(
        'src="exhibit_kaleidoscope.png"',
        f'src="{kaleidoscope_b64}"'
    ).replace(
        'src="exhibit_soul_eye.png"',
        f'src="{soul_eye_b64}"'
    ).replace(
        'src="exhibit_dove.png"',
        f'src="{dove_b64}"'
    )
    
    # 6. Save Standalone Compiled HTML
    output_html_path = os.path.join(workspace, "Confirmation_exhibition.html")
    with open(output_html_path, "w", encoding="utf-8") as f:
        f.write(html_compiled)
        
    # Clean up temporary compressed files
    for f in [kaleidoscope_temp, soul_eye_temp, dove_temp]:
        if os.path.exists(f):
            os.remove(f)
            
    print(f"\nSUCCESS: Standalone presentation compiled to: {output_html_path}")
    print(f"File size: {os.path.getsize(output_html_path) / 1024 / 1024:.2f} MB")

if __name__ == '__main__':
    compile_all()
