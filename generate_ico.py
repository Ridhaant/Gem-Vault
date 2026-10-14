import os
from PIL import Image, ImageDraw

def create_gem_icon():
    sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    base_img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    draw = ImageDraw.Draw(base_img)

    # Outer rounded square with emerald green gradient effect
    draw.rounded_rectangle([12, 12, 244, 244], radius=48, fill=(6, 78, 59, 255), outline=(16, 185, 129, 255), width=6)
    draw.rounded_rectangle([20, 20, 236, 236], radius=40, fill=(4, 120, 87, 255))

    # Inner Gem Facets (Brilliant Octagon Cut)
    # Table facet (center)
    table = [(88, 70), (168, 70), (200, 102), (200, 154), (168, 186), (88, 186), (56, 154), (56, 102)]
    draw.polygon(table, fill=(52, 211, 153, 240), outline=(209, 250, 229, 255), width=3)

    # Top Crown facet
    draw.polygon([(88, 70), (168, 70), (190, 42), (66, 42)], fill=(110, 231, 183, 255), outline=(209, 250, 229, 255), width=2)
    # Bottom Crown facet
    draw.polygon([(88, 186), (168, 186), (190, 214), (66, 214)], fill=(5, 150, 105, 255), outline=(209, 250, 229, 255), width=2)
    # Left facet
    draw.polygon([(56, 102), (56, 154), (28, 172), (28, 84)], fill=(16, 185, 129, 255), outline=(209, 250, 229, 255), width=2)
    # Right facet
    draw.polygon([(200, 102), (200, 154), (228, 172), (228, 84)], fill=(4, 120, 87, 255), outline=(209, 250, 229, 255), width=2)

    # Center diamond brilliant star
    draw.polygon([(128, 88), (148, 128), (128, 168), (108, 128)], fill=(255, 255, 255, 220))
    draw.polygon([(128, 100), (156, 128), (128, 156), (100, 128)], fill=(236, 253, 245, 180))

    # Corner sparkle
    draw.line([(180, 50), (204, 50)], fill=(255, 255, 255, 255), width=3)
    draw.line([(192, 38), (192, 62)], fill=(255, 255, 255, 255), width=3)

    # Save multi-size Windows .ico
    out_paths = [
        "gemvault.ico",
        os.path.join("frontend", "public", "gemvault.ico"),
        os.path.join("docs", "gemvault.ico"),
    ]

    for p in out_paths:
        os.makedirs(os.path.dirname(p) if os.path.dirname(p) else ".", exist_ok=True)
        base_img.save(p, format="ICO", sizes=sizes)
        print(f"Saved {p}")

if __name__ == "__main__":
    create_gem_icon()
