# Asset licences

Every file in `assets/models/` comes from the Khronos glTF Sample Assets collection
(https://github.com/KhronosGroup/glTF-Sample-Assets). Each one's own folder there has its `LICENSE.md` and `metadata.json`.
CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) asks for credit, which is given here; CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/) needs none, but the authors are listed anyway.

All of them were changed for the game: animations, lights and variants removed, glass turned into see-through blending,
material extensions that three.js r128 can't draw (sheen, specular, iridescence, volume...) folded into the base colour or dropped,
meshes simplified and quantized, and textures shrunk (at most 512 px, 256 px for the chess set) and saved as WebP.

| File | Size | Sample asset (source) | Author | Licence | Used for |
|---|---|---|---|---|---|
| `chess-set.glb` | 2836 KB | [ABeautifulGame](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ABeautifulGame) | Ed Mackey (glTF conversion); MaterialX Project (original model) | CC BY 4.0 | chess set |
| `avocado.glb` | 35 KB | [Avocado](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Avocado) | Microsoft | CC0 1.0 | avocado |
| `olive-dish.glb` | 620 KB | [IridescentDishWithOlives](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/IridescentDishWithOlives) | Eric Chadwick | CC BY 4.0 | olives |
| `fish.glb` | 179 KB | [BarramundiFish](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/BarramundiFish) | Microsoft | CC0 1.0 | fish, salmon, trout, cod |
| `teacup.glb` | 546 KB | [DiffuseTransmissionTeacup](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/DiffuseTransmissionTeacup) | Polyhaven.com and Eric Chadwick | CC0 1.0 | teacup, cup of tea |
| `water-bottle.glb` | 117 KB | [WaterBottle](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/WaterBottle) | Microsoft | CC0 1.0 | water bottle, canteen |
| `boombox.glb` | 179 KB | [BoomBox](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/BoomBox) | Microsoft | CC0 1.0 | boombox, radio, stereo |
| `antique-camera.glb` | 675 KB | [AntiqueCamera](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/AntiqueCamera) | Maximillan Kamps (the UX3D logo on it is a non-copyrightable trademark of UX3D) | CC0 1.0 | camera |
| `toy-car.glb` | 665 KB | [ToyCar](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ToyCar) | Eric Chadwick (scene); Guido Odendahl (car model) | CC0 1.0 | toy car, model car |
| `car.glb` | 2115 KB | [CarConcept](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept) | Eric Chadwick (the Khronos and 3D Commerce logos on it are non-copyrightable trademarks of Khronos) | CC BY 4.0 | car, sports car, sedan |
| `sunglasses.glb` | 214 KB | [SunglassesKhronos](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SunglassesKhronos) | Eric Chadwick (Khronos logos as above) | CC BY 4.0 | sunglasses |
| `armchair.glb` | 543 KB | [ChairDamaskPurplegold](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ChairDamaskPurplegold) | Eric Chadwick | CC BY 4.0 | armchair |
| `chair.glb` | 662 KB | [SheenChair](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenChair) | Eric Chadwick | CC0 1.0 | chair |
| `leather-sofa.glb` | 939 KB | [SheenWoodLeatherSofa](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenWoodLeatherSofa) | Eric Chadwick (improvements, CC BY 4.0); Fran Calvente (original, CC0 1.0) | CC BY 4.0 | leather sofa |
| `velvet-sofa.glb` | 165 KB | [GlamVelvetSofa](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlamVelvetSofa) | Eric Chadwick | CC BY 4.0 | sofa, couch |
| `pouf.glb` | 543 KB | [SpecularSilkPouf](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SpecularSilkPouf) | Eric Chadwick | CC BY 4.0 | pouf, ottoman, footstool |
| `stained-glass-lamp.glb` | 1628 KB | [StainedGlassLamp](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/StainedGlassLamp) | Eric Chadwick | CC BY 4.0 | stained-glass lamp |
| `barn-lamp.glb` | 308 KB | [AnisotropyBarnLamp](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/AnisotropyBarnLamp) | Eric Chadwick | CC BY 4.0 | barn lamp, pendant lamp |
| `table-lamp.glb` | 338 KB | [IridescenceLamp](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/IridescenceLamp) | Eric Chadwick | CC BY 4.0 | lamp, desk lamp, table lamp |
| `street-lantern.glb` | 224 KB | [Lantern](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Lantern) | sbtron; Frank Galligan | CC0 1.0 | lamp post, street lamp |
| `fridge.glb` | 1184 KB | [CommercialRefrigerator](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CommercialRefrigerator) | Eric Chadwick; based on "Commercial Fridge" by Sean Thomas (https://sketchfab.com/3d-models/commercial-fridge-2174e1e4f1f24f1a95aa110ee060f473) | CC BY 4.0 | fridge, refrigerator |
| `house-plant.glb` | 1671 KB | [DiffuseTransmissionPlant](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/DiffuseTransmissionPlant) | Eric Chadwick (materials, CC BY 4.0); Rico Cilliers (original, CC0 1.0) | CC BY 4.0 | house plant, potted plant, fern |
| `vase-of-flowers.glb` | 274 KB | [GlassVaseFlowers](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlassVaseFlowers) | Eric Chadwick (vase); Rico Cilliers (flowers) | CC0 1.0 | flowers, bouquet, vase |
| `candle-holder.glb` | 88 KB | [GlassHurricaneCandleHolder](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlassHurricaneCandleHolder) | Eric Chadwick (the Khronos and glTF logos on it are non-copyrightable trademarks of Khronos) | CC BY 4.0 | candle |
| `traffic-cone.glb` | 319 KB | [TrafficCone](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/TrafficCone) | hinndia (model and textures, CC BY 4.0); Rob Tuytel (asphalt, CC0 1.0; its ground plane was removed) | CC BY 4.0 | traffic cone |
| `sneaker.glb` | 484 KB | [MaterialsVariantsShoe](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/MaterialsVariantsShoe) | Shopify | CC BY 4.0 | sneakers, shoes |
| `skull.glb` | 308 KB | [ScatteringSkull](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ScatteringSkull) | Vladimir Petkovic | CC0 1.0 | skull |

Total: 18.3 MB.

## Code

`js/vendor/GLTFLoader.js` is three.js r128's `examples/js/loaders/GLTFLoader.js`, unchanged, from the npm package `three@0.128.0`.
MIT License, Copyright © 2010-2021 three.js authors (https://github.com/mrdoob/three.js/blob/r128/LICENSE).

## Sky, water and ground (js/realism.js)
| File | What it is | Source | Licence |
|---|---|---|---|
| `hdri/quarry_01_1k.hdr` | Daytime outdoor HDR photo (lighting by day) | Poly Haven "Quarry 01", via the three.js repo (`examples/textures/equirectangular`, tag r128) | CC0 1.0 |
| `hdri/venice_sunset_1k.hdr` | Sunset HDR photo (golden hour lighting) | Poly Haven "Venice Sunset", via the three.js repo (tag r128) | CC0 1.0 |
| `hdri/moonless_golf_1k.hdr` | Night HDR photo (starlight) | Poly Haven "Moonless Golf", via the three.js repo (`dev` branch) | CC0 1.0 |
| `textures/waternormals.jpg` | Tiling water ripple normal map | three.js repo, `examples/textures/waternormals.jpg` (tag r128) | MIT (three.js) |
| `textures/terrain/grass.jpg`, `dirt.jpg`, `rock.jpg`, `sand.jpg`, `snow.jpg` | Tiling ground textures | Generated for this project by `scripts/terrain-textures.py` | CC0 1.0 |

The three.js add-on scripts in `js/vendor/` (RGBELoader, Sky, EffectComposer, RenderPass, ShaderPass,
UnrealBloomPass, CopyShader, LuminosityHighPassShader) are copied unchanged from the npm package
`three@0.128.0` (`examples/js/`), MIT licence, copyright 2010-2021 three.js authors.
