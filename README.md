# Fractal Lab

Interactive visual explorer for classic fractals and self-similar geometry. Adjust depth, angles, colors, and more in real time.

## Run

No build step. From this folder:

```bash
# Option A — open directly
open index.html

# Option B — local server (recommended)
python3 -m http.server 8765
# then visit http://localhost:8765
```

## Fractals

| Fractal | What you can tweak |
|--------|---------------------|
| **Sierpiński Triangle** | Depth, scale, rotation, outline |
| **Sierpiński Carpet** | Depth, scale |
| **Koch Snowflake** | Depth, scale, rotation, curve vs closed snowflake |
| **Vicsek Fractal** | Depth, scale, cross vs diagonal |
| **Fractal Tree** | Depth, branch angle, length ratio, lean, ternary mode |
| **Pythagoras Tree** | Depth, scale, split angle |
| **Dragon Curve** | Order, scale |
| **Hilbert Curve** | Order, scale |
| **Barnsley Fern** | Point count, stem/leaflet stretch, curl |
| **Mandelbrot / Julia** | Iterations, zoom, center, Julia constant, color cycles |

## Controls

- **Scroll** — zoom  
- **Drag** — pan  
- **Double-click** — reset view  
- **Export PNG** — download the current canvas  

Appearance: background, stroke, fill, line width, depth gradient, filled shapes.

## Stack

Vanilla HTML / CSS / Canvas 2D. No dependencies.
