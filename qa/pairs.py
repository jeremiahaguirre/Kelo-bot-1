# Side-by-side before/after images (each half scaled to 1280 wide), labelled
import sys, os
from PIL import Image, ImageDraw, ImageFont
out = '/home/user/qa/pairs'; os.makedirs(out, exist_ok=True)
font = None
for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
    if os.path.exists(f): font = ImageFont.truetype(f, 34)
for name in sys.argv[1:]:
    lvl, view = name.split(':')
    b = Image.open(f'/home/user/qa/out/before-{lvl}-{view}.png'); a = Image.open(f'/home/user/qa/out/after-{lvl}-{view}.png')
    w = 1280; h = int(b.height * w / b.width)
    b = b.resize((w, h), Image.LANCZOS); a = a.resize((w, h), Image.LANCZOS)
    im = Image.new('RGB', (w * 2 + 12, h), (20, 20, 24)); im.paste(b, (0, 0)); im.paste(a, (w + 12, 0))
    d = ImageDraw.Draw(im)
    label = {'balanced': 'Medium', 'high': 'High', 'fast': 'Low'}[lvl]
    for x, t in [(0, f'BEFORE  {view} ({label})'), (w + 12, f'AFTER  {view} ({label})')]:
        d.rectangle([x + 20, h - 70, x + 20 + 560, h - 18], fill=(15, 23, 42))
        d.text((x + 34, h - 64), t, fill=(250, 204, 21), font=font)
    im.save(f'{out}/pair-{view}-{label.lower()}.png'); print('pair', view, label)
