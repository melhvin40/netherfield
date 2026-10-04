#!/usr/bin/env bash
# Builds the two aerial films from the original drone reel: the home reel (Mykonos, then a sailing yacht)
# and Athens at sunset (Why Netherfield). Each scene is cut between the reel's crossfades, slowed to half
# speed with motion-compensated interpolation, upscaled with Lanczos and closed into a seamless loop.
# The reel itself is no longer part of the site; it is read from the repository history.
# usage: tools/make-hero-clips.sh [path/to/reel.mp4]
# Output: video/<name>.mp4 (H.264), video/<name>.webm (VP9), img/hero/<name>.jpg (poster)
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
SRC=${1:-}
if [ -z "$SRC" ]; then SRC=$TMP/reel.mp4; git show 4abff86:video/hero-loop.mp4 > "$SRC"; fi
mkdir -p video img/hero
F=1.0   # loop dissolve, seconds of output time

slow() { # name start duration -> $TMP/name.mp4 (half speed, 1600x900, near-lossless)
  ffmpeg -nostdin -v error -y -ss "$2" -t "$3" -i "$SRC" -an \
    -vf "setpts=2.0*PTS,minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,scale=1600:900:flags=lanczos,unsharp=5:5:0.4:5:5:0.0" \
    -c:v libx264 -preset veryfast -crf 10 -pix_fmt yuv420p "$TMP/$1.mp4"
}
encode() { # name filtergraph inputs...
  local name=$1 fc=$2; shift 2
  ffmpeg -nostdin -v error -y "$@" -filter_complex "$fc" -an \
    -c:v libx264 -preset slow -tune film -crf 23 -profile:v high -level 4.0 -g 60 -movflags +faststart "video/$name.mp4"
  ffmpeg -nostdin -v error -y "$@" -filter_complex "$fc" -an \
    -c:v libvpx-vp9 -crf 37 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 -g 60 "video/$name.webm"
  ffmpeg -nostdin -v error -y -i "video/$name.mp4" -frames:v 1 -q:v 3 "img/hero/$name.jpg"
  ls -la "video/$name.mp4" "video/$name.webm" "img/hero/$name.jpg"
}
loop() { # input duration -> filtergraph that dissolves the tail into the head
  echo "[0:v]split[a][b];[a]trim=start=$F,setpts=PTS-STARTPTS[A];[b]trim=end=$F,setpts=PTS-STARTPTS[B];[A][B]xfade=transition=fade:duration=$F:offset=$(python3 -c "print(round($1-2*$F,3))"),format=yuv420p"
}

# Athens at sunset: 4.85 s of the reel -> 9.7 s loop
slow athens 23.05 4.85
encode athens "$(loop 9.7)" -i "$TMP/athens.mp4"

# Home reel: Mykonos (4.7 s) dissolving into the yacht (3.9 s), slowed, closed into one loop
slow mykonos 0.10 4.70
slow yacht 10.05 3.90
encode home "[0:v]settb=AVTB,fps=30,format=yuv420p[m];[1:v]settb=AVTB,fps=30,format=yuv420p[y];[m][y]xfade=transition=fade:duration=1:offset=8.4[c];[c]split[a][b];[a]trim=start=1,setpts=PTS-STARTPTS[A];[b]trim=end=1,setpts=PTS-STARTPTS[B];[A][B]xfade=transition=fade:duration=1:offset=14.2,format=yuv420p" -i "$TMP/mykonos.mp4" -i "$TMP/yacht.mp4"
echo DONE
