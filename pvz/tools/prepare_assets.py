#!/usr/bin/env python3
"""素材预处理：批量抠图 -> 裁掉透明边 -> 统一尺寸 -> 输出到 assets/。

用法：python3 tools/prepare_assets.py
"""
import json
import os
import re
import subprocess
import urllib.request

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "assets", "raw")
OUT = os.path.join(ROOT, "assets")
TMP = os.path.join(ROOT, "assets", "cut")

# 原始文件 -> (输出名, 目标高度 px)
JOBS = [
    ("sunflower.png", "plant_sunflower", 150),
    ("pea1.jpg", "plant_peashooter", 150),
    ("cabbage.jpg", "plant_cabbage", 150),
    ("potato.jpg", "plant_potato", 120),
    ("wallnut.jpg", "plant_wallnut", 140),
    ("cherry.jpg", "plant_cherry", 130),
    ("zombie_normal.jpg", "zombie_normal", 180),
    ("cone.png", "zombie_cone", 180),
    ("bucket.png", "zombie_bucket", 190),
    ("pole.jpg", "zombie_pole", 170),
]


def cut_bg(src, dst):
    """调用 mediakit-cli 抠图并下载结果。"""
    p = subprocess.run(
        ["mediakit-cli", "image", "remove-image-background",
         "--image-url", src, "--scene", "general", "--output-format", "png"],
        capture_output=True, text=True,
    )
    text = p.stdout
    start = text.find("{")
    if start < 0:
        raise RuntimeError("没有 JSON 输出: " + (p.stderr or text)[:300])
    try:
        data = json.loads(text[start:])
    except json.JSONDecodeError:
        m = re.search(r'"image_url"\s*:\s*"([^"]+)"', text)
        if not m:
            raise RuntimeError("解析失败: " + text[-300:])
        url = m.group(1).replace("\\u0026", "&")
    else:
        if not data.get("success"):
            raise RuntimeError("抠图失败: " + json.dumps(data)[:300])
        url = data["image_url"]

    urllib.request.urlretrieve(url, dst)
    return dst


def normalize(path, out_path, target_h):
    """裁掉透明边，等比缩放到目标高度，保存为 PNG。"""
    im = Image.open(path).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    scale = target_h / h
    im = im.resize((max(1, round(w * scale)), target_h), Image.LANCZOS)
    im.save(out_path, "PNG", optimize=True)
    return im.size


def main():
    os.makedirs(TMP, exist_ok=True)
    for src_name, out_name, target_h in JOBS:
        src = os.path.join(RAW, src_name)
        if not os.path.exists(src):
            print(f"[skip] 缺少 {src_name}")
            continue
        cut = os.path.join(TMP, out_name + "_cut.png")
        try:
            cut_bg(src, cut)
        except Exception as exc:  # 单张失败不影响其它
            print(f"[fail] {src_name}: {exc}")
            continue
        out_path = os.path.join(OUT, out_name + ".png")
        size = normalize(cut, out_path, target_h)
        print(f"[ok] {out_name}.png {size}")


if __name__ == "__main__":
    main()
