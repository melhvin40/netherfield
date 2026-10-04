#!/usr/bin/env bash
# Builds the cinematic hero loops from the source drone reel (video/hero-loop.mp4).
# Each scene is cut between its crossfades, slowed to half speed with motion-compensated
# interpolation, upscaled with Lanczos and closed into a seamless loop by dissolving its
# tail into its head. Output: video/<name>.mp4 (H.264), video/<name>.webm (VP9), img/hero/<name>.jpg
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=video/hero-loop.mp4
TMP=$(mktemp -d)
mkdir -p video img/hero
F=1.0   # loop dissolve, seconds of output time
# name start duration
SCENES="mykonos 0.10 4.70
bay 5.50 3.90
yacht 10.05 3.90
beach 14.75 3.25
caldera 18.55 3.95
athens 23.05 4.85"
echo "$SCENES" | while read -r NAME START DUR; do
  # ONLY="bay caldera" ./tools/make-hero-clips.sh rebuilds just those scenes
  case " ${ONLY:-$NAME} " in *" $NAME "*) ;; *) continue ;; esac
  L=$(python3 -c "print(round($DUR*2,3))")
  OFF=$(python3 -c "print(round($DUR*2-2*$F,3))")
  echo "== $NAME: $START +$DUR s -> ${L}s slow, loop offset $OFF"
  ffmpeg -nostdin -v error -y -ss "$START" -t "$DUR" -i "$SRC" -an \
    -vf "setpts=2.0*PTS,minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,scale=1600:900:flags=lanczos,unsharp=5:5:0.4:5:5:0.0" \
    -c:v libx264 -preset veryfast -crf 10 -pix_fmt yuv420p "$TMP/$NAME-slow.mp4"
  FC="[0:v]split[a][b];[a]trim=start=$F,setpts=PTS-STARTPTS[A];[b]trim=end=$F,setpts=PTS-STARTPTS[B];[A][B]xfade=transition=fade:duration=$F:offset=$OFF,format=yuv420p"
  ffmpeg -nostdin -v error -y -i "$TMP/$NAME-slow.mp4" -filter_complex "$FC" -an \
    -c:v libx264 -preset slow -tune film -crf 24 -profile:v high -level 4.0 -g 60 -movflags +faststart "video/$NAME.mp4"
  ffmpeg -nostdin -v error -y -i "$TMP/$NAME-slow.mp4" -filter_complex "$FC" -an \
    -c:v libvpx-vp9 -crf 37 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 -g 60 "video/$NAME.webm"
  ffmpeg -nostdin -v error -y -i "video/$NAME.mp4" -frames:v 1 -q:v 3 "img/hero/$NAME.jpg"
  ls -la "video/$NAME.mp4" "video/$NAME.webm" "img/hero/$NAME.jpg"
done
# the home reel itself: same bytes, moov atom moved to the front so it starts streaming at once
ffmpeg -nostdin -v error -y -i "$SRC" -c copy -movflags +faststart "$TMP/home.mp4" && mv "$TMP/home.mp4" "$SRC"
[ -f video/hero-loop.webm ] || ffmpeg -nostdin -v error -y -i "$SRC" -an -c:v libvpx-vp9 -crf 36 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 video/hero-loop.webm
rm -rf "$TMP"
echo DONE
