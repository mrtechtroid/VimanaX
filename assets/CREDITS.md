# Asset credits

Bundled glTF models in `assets/models/` (all optional: the game falls back to procedural stand-ins if they fail to load).
**Check each licence before you ship or redistribute.** Sources were taken from public GitHub repositories; the licence notes below are what the sources state, not legal advice.

| File | What | Source / licence note |
|---|---|---|
| `Soldier.glb` | Animated pilot/walker (Idle, Walk, Run) | three.js examples (`examples/models/gltf/Soldier.glb`). https://sketchfab.com/3d-models/soldier-mixamo-379f325184c743f68a07774269eb5c56 |
| `ferrari.glb` | Ferrari 458 Italia (Draco-compressed) | three.js examples (`examples/models/gltf/ferrari.glb`); credited there to vicent091036 (Sketchfab). https://sketchfab.com/3d-models/ferrari-458-italia-aa53bd0303014af2aa4d80341566ad8c |
| `CesiumMilkTruck.glb` | Milk truck | Khronos glTF-Sample-Assets, `CesiumMilkTruck`; CC-BY 4.0, (c) Cesium. Attribution required. |

The aircraft (Skylark 172, Atlas T4), the Scout 4x4, crates, cockpits and all code are original procedural work in this repository.

## Aircraft models (`assets/models/aircraft/`)

Taken from Flightradar24's [fr24-3d-models](https://github.com/Flightradar24/fr24-3d-models) (GPLv2, see `FR24-LICENSE.txt`). The originals are glTF 1.0; they were converted to glTF 2.0
with Draco compression by `tools/convert-fr24.sh` (gltf-pipeline) and are otherwise unmodified. Upstream sources named by FR24:

| File | Aircraft | Upstream source |
|---|---|---|
| `pa28.glb` | Piper PA-28 | https://github.com/FGMEMBERS/Piper-PA-28 |
| `citation.glb` | Cessna Citation II | https://github.com/FGMEMBERS/Citation |
| `atr42.glb` | ATR 42 | https://github.com/FGMEMBERS/ATR-42-500 |
| `b738.glb` | Boeing 737-800 | https://github.com/FGMEMBERS/737-800 |

**Licence note (not legal advice):** these four models are GPLv2. This repository's code is GPLv3. GPLv2-only and GPLv3 material cannot simply be combined into one work
(the FR24 README says "GPLv2" without an "or later" clause), so if you redistribute the whole package, check this with a lawyer, or swap the models for ones you own: the
game works without them (procedural airframes) and the hook in `src/aircraft/GltfSkin.js` accepts any glTF whose node names you list in the aircraft definition.

The Skylark, Atlas T4, Scout 4x4, crates, cockpits, terrain and all code are original procedural work in this repository.
