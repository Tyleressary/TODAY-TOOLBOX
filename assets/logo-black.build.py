# Produce assets/logo-black.png from the supplied BLACK.png, and do nothing
# else to it: crop the transparent padding the file carries, scale the
# artwork to 720 wide with Lanczos on premultiplied alpha (so no colour
# bleeds out of transparent pixels at the edges), and centre it in a
# transparent 720x98 canvas -- the exact dimensions of the white lockup
# already in use, so the drawn box cannot change when the two are swapped.
import sys
from PIL import Image

src_path, out_path = sys.argv[1], sys.argv[2]
im = Image.open(src_path).convert('RGBA')
print('source', im.size)

box = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
art = im.crop(box)
print('artwork bounds', box, '->', art.size, 'ratio', round(art.size[0] / art.size[1], 4))

W, H = 720, 98
tw = W
th = max(1, round(art.size[1] * W / art.size[0]))

# premultiply, resample, unpremultiply
r, g, b, a = art.split()
pm = Image.merge('RGBA', (
    Image.eval(r, lambda v: v), Image.eval(g, lambda v: v), Image.eval(b, lambda v: v), a))
px = pm.load()
for y in range(pm.size[1]):
    for x in range(pm.size[0]):
        cr, cg, cb, ca = px[x, y]
        f = ca / 255
        px[x, y] = (int(cr * f + 0.5), int(cg * f + 0.5), int(cb * f + 0.5), ca)
small = pm.resize((tw, th), Image.LANCZOS)
sp = small.load()
for y in range(th):
    for x in range(tw):
        cr, cg, cb, ca = sp[x, y]
        if ca == 0:
            sp[x, y] = (0, 0, 0, 0)
        else:
            f = 255 / ca
            sp[x, y] = (min(255, int(cr * f + 0.5)), min(255, int(cg * f + 0.5)),
                        min(255, int(cb * f + 0.5)), ca)

# The artwork is 0.55% wider in proportion than the white lockup, so fitting
# it to 720 leaves 97 rows in a 98-row canvas. Centring would round to a half
# pixel either way (both measured 0.50px off white's centroid); bottom
# alignment is the tie-break, because the lockup is anchored on the card's
# bottom margin and that is the edge a reader's eye lines up.
out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
out.paste(small, (0, H - th))
out.save(out_path, optimize=True)
print('wrote', out_path, out.size, 'artwork', (tw, th), 'at y', H - th, '(bottom aligned)')
