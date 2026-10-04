# Villa and interior visualisations

The films on Properties, Golden Visa Benefits and Testimonials, and the Golden Visa benefit panels are computer-generated visualisations made for this concept. They stand in
until licensed footage or the agency's own photography replaces them (same file names, see the main README).

| File | What it is |
|---|---|
| `vlib.py` | Small toolkit: materials (plaster, stone, travertine, teak, glass, water, sea), shapes, sky, cameras |
| `villa_a.py` | A Cycladic villa on a hillside above the Aegean: infinity pool, pergola, cypresses |
| `villa_b.py` | A modern Riviera villa: stone, glass and cantilevered white roofs, lawn, umbrella pines |
| `interiors.py` | A sea-view living room with a reading wall and dining area, and a bedroom |
| `render.sh` | Renders every still used on the site (Cycles, 1920 x 1080) into `tools/visuals/out/` |
| `make_media.py` | Grades the stills and cuts the films (slow push-ins that dissolve into a seamless loop) and images |

```
pip install bpy==5.0.1          # Blender as a Python module (Python 3.11)
tools/visuals/render.sh         # about an hour on four CPU cores
python3 tools/visuals/make_media.py tools/visuals/out .
```
