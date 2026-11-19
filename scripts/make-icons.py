#!/usr/bin/env python3
"""Flat PNG icons: a pale teardrop eye on a dark cave background."""
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public" / "icons"


def chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path, w, h, px):
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw.extend(px[y])
    data = b"\x89PNG\r\n\x1a\n"
    data += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    data += chunk(b"IEND", b"")
    path.write_bytes(data)


def icon(size):
    px = []
    cx = cy = (size - 1) / 2
    s = size * 0.34
    for y in range(size):
        row = bytearray()
        for x in range(size):
            nx = (x - cx) / s
            ny = (y - cy) / s + 0.15
            # rounded square background
            dx = abs(x - cx) / (size * 0.46)
            dy = abs(y - cy) / (size * 0.46)
            edge = max(dx, dy)
            bg = (12, 16, 24, 255) if edge < 1 else (7, 9, 13, 255)
            eye = False
            # lower bulb
            if nx * nx + (ny + 0.05) ** 2 < 0.42:
                eye = True
            # upper point
            if -1.15 < ny < 0.05 and abs(nx) < (0.15 - ny) * 0.55:
                eye = True
            if eye:
                shade = 245 if ny > -0.2 else 230
                row.extend((shade, shade, int(shade * 0.96), 255))
            else:
                # faint red scratch
                if abs((y - x * 0.15) - size * 0.72) < size * 0.008 and x > size * 0.58:
                    row.extend((150, 48, 42, 255))
                else:
                    row.extend(bg)
        px.append(row)
    return px


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, size in (("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)):
        write_png(OUT / name, size, size, icon(size))
        print(OUT / name)


if __name__ == "__main__":
    main()
