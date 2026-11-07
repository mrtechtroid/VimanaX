#!/usr/bin/env bash
# Convert FR24 glTF 1.0 models to glTF 2.0 + Draco for three.js.  Usage: tools/convert-fr24.sh /path/to/fr24-3d-models/models pa28 citation atr42 b738
set -euo pipefail
src="$1"; shift; out="$(dirname "$0")/../assets/models/aircraft"; mkdir -p "$out"
for m in "$@"; do npx --yes gltf-pipeline -i "$src/$m.glb" -o "$out/$m.glb" -d; done
