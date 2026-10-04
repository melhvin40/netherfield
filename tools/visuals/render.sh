#!/usr/bin/env bash
# Renders every visualisation still used on the site into tools/visuals/out (1920 x 1080, Cycles on the CPU).
# Needs Blender as a Python module: pip install bpy==5.0.1 (Python 3.11). PYTHON overrides the interpreter.
set -euo pipefail
cd "$(dirname "$0")"
PY=${PYTHON:-python3}
mkdir -p out
run() { # scene shot light samples name
  if [ -f "out/$5.png" ]; then echo "have $5"; return; fi
  "$PY" "$1.py" "$2" 1920 1080 "$4" "out/$5.tmp.png" "$3" | grep -E "RENDERED|Error" || true
  mv "out/$5.tmp.png" "out/$5.png"
}
# films: villas (Properties), residences (Golden Visa), homes (Testimonials)
run villa_a east3q blue 64 villa-a-east-blue
run villa_b hero sunset 64 villa-b-hero-sunset
run villa_a front sunset 64 villa-a-front-sunset
run villa_a west3q blue 64 villa-a-west-blue
run villa_b front blue 64 villa-b-front-blue
run interiors living sunset 48 interior-living-sunset
run villa_a pergola sunset 64 villa-a-pergola-sunset
run interiors dining sunset 48 interior-dining-sunset
run villa_b garden golden 64 villa-b-garden-golden
# Golden Visa benefit panels
run interiors bedroom morning 48 interior-bedroom-morning
run villa_b detail sunset 64 villa-b-detail-sunset
run villa_a pool sunset 64 villa-a-pool-sunset
run interiors study golden 48 interior-study-golden
