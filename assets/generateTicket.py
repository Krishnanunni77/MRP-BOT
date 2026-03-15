#!/usr/bin/env python3
# generateTicket.py — called by Node.js with: python3 generateTicket.py "NAME" "output.png"

import sys
import datetime
from PIL import Image, ImageDraw, ImageFont
import os

name = sys.argv[1].upper() if len(sys.argv) > 1 else "PASSENGER"
output_path = sys.argv[2] if len(sys.argv) > 2 else "/tmp/ticket_out.png"

# Source image — always next to this script
script_dir = os.path.dirname(os.path.abspath(__file__))
source_img = os.path.join(script_dir, 'ticket_template.png')

now = datetime.datetime.now()
date_str = now.strftime("%d %b %Y").upper()
time_str = now.strftime("%H:%M")

img = Image.open(source_img).convert('RGBA')
draw = ImageDraw.Draw(img)

FONT_DIR = '/usr/share/fonts/truetype/liberation/'
font_name = ImageFont.truetype(os.path.join(FONT_DIR, 'LiberationMono-Bold.ttf'), 26)
font_small = ImageFont.truetype(os.path.join(FONT_DIR, 'LiberationMono-Bold.ttf'), 19)

GOLD  = (255, 215, 0, 255)
WHITE = (255, 255, 255, 255)

def draw_centered(text, font, color, x1, y1, x2, y2):
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    bb = draw.textbbox((0, 0), text, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    draw.text((cx - tw // 2, cy - th // 2), text, font=font, fill=color)

# PASSENGER NAME  — golden, centered in the dark name box
draw_centered(name,     font_name,  GOLD,  680, 128, 985, 180)

# DATE — white, centered in left date box
draw_centered(date_str, font_small, WHITE, 680, 218, 830, 268)

# TIME — white, centered in right time box
draw_centered(time_str, font_small, WHITE, 840, 218, 985, 268)

img = img.convert('RGB')
img.save(output_path)
print(f"OK:{output_path}")
