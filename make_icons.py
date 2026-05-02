from PIL import Image
import os

src = r'C:\Users\islam\.gemini\antigravity\brain\e3650e8a-b340-406c-8009-d98300b48d83\searchshift_icon_1777743417770.png'
out_dir = r'e:\Programming\searchshift\icons'
os.makedirs(out_dir, exist_ok=True)

img = Image.open(src).convert('RGBA')
for size in [16, 32, 48, 128]:
    resized = img.resize((size, size), Image.LANCZOS)
    resized.save(os.path.join(out_dir, f'icon{size}.png'))
    print(f'icon{size}.png created')
print('Done')
