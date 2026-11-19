#!/usr/bin/env python3
"""Dark horror icon and splash: a wallskitter seen from above."""
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "assets"


def chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path, w, h, buf):
    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        raw.extend(buf[y * stride:(y + 1) * stride])
    data = b"\x89PNG\r\n\x1a\n"
    data += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(bytes(raw), 6))
    data += chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def new_buf(w, h, color):
    px = bytearray(color * (w * h))
    return px


def blend(buf, w, x, y, r, g, b, a):
    if x < 0 or y < 0 or x >= w:
        return
    h = len(buf) // (w * 4)
    if y >= h:
        return
    i = (y * w + x) * 4
    sa = a / 255
    da = buf[i + 3] / 255
    out_a = sa + da * (1 - sa)
    if out_a <= 0:
        return
    buf[i] = int((r * sa + buf[i] * da * (1 - sa)) / out_a)
    buf[i + 1] = int((g * sa + buf[i + 1] * da * (1 - sa)) / out_a)
    buf[i + 2] = int((b * sa + buf[i + 2] * da * (1 - sa)) / out_a)
    buf[i + 3] = int(out_a * 255)


def disc(buf, w, cx, cy, rx, ry, color, aa=1.5):
    r, g, b, a = color
    x0 = int(cx - rx - aa - 1)
    x1 = int(cx + rx + aa + 2)
    y0 = int(cy - ry - aa - 1)
    y1 = int(cy + ry + aa + 2)
    h = len(buf) // (w * 4)
    for y in range(max(0, y0), min(h, y1)):
        for x in range(max(0, x0), min(w, x1)):
            nx = (x - cx) / rx
            ny = (y - cy) / ry
            d = (nx * nx + ny * ny) ** 0.5
            if d < 1:
                blend(buf, w, x, y, r, g, b, a)
            elif d < 1 + aa / min(rx, ry):
                t = 1 - (d - 1) / (aa / min(rx, ry))
                blend(buf, w, x, y, r, g, b, int(a * max(0, t)))


def line(buf, w, x0, y0, x1, y1, radius, color):
    steps = int(max(abs(x1 - x0), abs(y1 - y0), 1))
    for i in range(steps + 1):
        t = i / steps
        disc(buf, w, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius, radius, color, aa=1.2)


def eye(buf, w, cx, cy, s, angle):
    # teardrop: bulb plus a point, rotated roughly by placing the point offset
    import math
    disc(buf, w, cx, cy, s * 0.55, s * 0.42, (248, 250, 255, 255))
    px = cx + math.sin(angle) * s * 0.7
    py = cy - math.cos(angle) * s * 0.75
    disc(buf, w, px, py, s * 0.22, s * 0.34, (248, 250, 255, 255))
    disc(buf, w, cx, cy, s * 0.16, s * 0.12, (20, 28, 48, 255))


def wallskitter(buf, w, cx, cy, scale):
    import math
    # legs first so the body covers the joints
    for side in (-1, 1):
        for i in range(5):
            z = -0.55 + i * 0.28
            hipx = cx + side * 0.28 * scale
            hipy = cy + z * scale
            knee = 0.55 + (2 - abs(i - 2)) * 0.08
            kx = cx + side * knee * scale
            ky = cy + (z - 0.05) * scale
            tx = cx + side * (1.05 + (i % 2) * 0.08) * scale
            ty = cy + (z + 0.22) * scale
            line(buf, w, hipx, hipy, kx, ky, max(2, scale * 0.045), (18, 36, 72, 255))
            line(buf, w, kx, ky, tx, ty, max(1.5, scale * 0.03), (14, 28, 58, 255))
    # tail
    for i in range(4):
        disc(buf, w, cx, cy + (0.55 + i * 0.16) * scale, scale * (0.16 - i * 0.02), scale * (0.12 - i * 0.015), (22, 42, 78, 255))
    disc(buf, w, cx, cy + 1.15 * scale, scale * 0.05, scale * 0.09, (30, 50, 90, 255))
    # body
    disc(buf, w, cx, cy, scale * 0.46, scale * 0.72, (16, 32, 62, 255))
    disc(buf, w, cx, cy - scale * 0.08, scale * 0.34, scale * 0.48, (28, 52, 96, 255))
    # head
    disc(buf, w, cx, cy - scale * 0.62, scale * 0.28, scale * 0.22, (20, 40, 74, 255))
    eye(buf, w, cx - scale * 0.12, cy - scale * 0.66, scale * 0.16, -0.5)
    eye(buf, w, cx + scale * 0.12, cy - scale * 0.66, scale * 0.16, 0.5)
    for side in (-1, 1):
        line(
            buf, w,
            cx + side * scale * 0.08, cy - scale * 0.78,
            cx + side * scale * 0.22, cy - scale * 1.15,
            max(1.2, scale * 0.018),
            (40, 64, 110, 255),
        )


def vignette(buf, w, h):
    cx, cy = w / 2, h / 2
    maxd = (cx * cx + cy * cy) ** 0.5
    # sparse darkening toward corners
    step = 2
    for y in range(0, h, step):
        for x in range(0, w, step):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / maxd
            if d > 0.45:
                a = int(min(180, (d - 0.45) * 320))
                for yy in range(y, min(h, y + step)):
                    for xx in range(x, min(w, x + step)):
                        blend(buf, w, xx, yy, 0, 0, 0, a)


def icon(size, transparent_bg=False):
    bg = (0, 0, 0, 0) if transparent_bg else (12, 16, 24, 255)
    buf = new_buf(size, size, bg)
    if not transparent_bg:
        disc(buf, size, size * 0.5, size * 0.55, size * 0.7, size * 0.45, (18, 28, 46, 255))
    wallskitter(buf, size, size * 0.5, size * 0.52, size * 0.34)
    return buf


def splash(size):
    buf = new_buf(size, size, (7, 9, 13, 255))
    disc(buf, size, size * 0.5, size * 0.48, size * 0.42, size * 0.28, (14, 22, 36, 255))
    # faint wing-like arcs
    line(buf, size, size * 0.18, size * 0.42, size * 0.5, size * 0.36, size * 0.008, (24, 20, 40, 180))
    line(buf, size, size * 0.82, size * 0.42, size * 0.5, size * 0.36, size * 0.008, (24, 20, 40, 180))
    wallskitter(buf, size, size * 0.5, size * 0.5, size * 0.16)
    vignette(buf, size, size)
    return buf


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    write_png(ROOT / "icon-only.png", 1024, 1024, icon(1024))
    write_png(ROOT / "icon-foreground.png", 1024, 1024, icon(1024, transparent_bg=True))
    write_png(ROOT / "icon-background.png", 1024, 1024, new_buf(1024, 1024, (12, 16, 24, 255)))
    art = splash(2732)
    write_png(ROOT / "splash.png", 2732, 2732, art)
    write_png(ROOT / "splash-dark.png", 2732, 2732, art)
    print("wrote", ROOT)


if __name__ == "__main__":
    main()
