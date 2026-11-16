
**Low** (`fast`)

| view | draw calls before → after | triangles before → after | game JS ms/frame outside render, before → after | frame ms (software GL) before → after |
|---|---|---|---|---|
| town | 1206 → **1049** (-13%) | 289k → 298k | 8.43 → 1.7 | 878 → 818 |
| mainstreet | 1248 → **1026** (-18%) | 259k → 267k | 2.72 → 1.33 | 879 → 834 |
| lakeshore | 1167 → **1104** (-5%) | 272k → 274k | 2.25 → 1.58 | 1072 → 932 |
| meadow | 1092 → **885** (-19%) | 251k → 261k | 1.87 → 1.43 | 822 → 884 |
| workshop | 1065 → **1005** (-6%) | 327k → 327k | 11.8 → 9.85 | 1348 → 1263 |
| northyard | 189 → **189** (+0%) | 208k → 209k | 2.55 → 8.02 | 657 → 686 |
| golden | 1361 → **1248** (-8%) | 343k → 346k | 1.73 → 2.47 | 810 → 799 |
| night | 1087 → **1124** (+3%) | 287k → 319k | 2.47 → 2.58 | 751 → 817 |
| all 8 views | 8415 → **7630** (-9%) | | | |

**Medium** (`balanced`)

| view | draw calls before → after | triangles before → after | game JS ms/frame outside render, before → after | frame ms (software GL) before → after |
|---|---|---|---|---|
| town | 1297 → **1134** (-13%) | 308k → 316k | 6.1 → 7.35 | 1204 → 1229 |
| mainstreet | 1342 → **1081** (-19%) | 274k → 278k | 5.73 → 5.28 | 1231 → 1332 |
| lakeshore | 1180 → **1128** (-4%) | 267k → 271k | 5.98 → 5.23 | 1564 → 1462 |
| meadow | 1093 → **891** (-18%) | 255k → 267k | 4.47 → 4.27 | 1321 → 1366 |
| workshop | 1203 → **1303** (+8%) | 369k → 378k | 14.63 → 11.07 | 2010 → 1830 |
| northyard | 208 → **241** (+16%) | 210k → 213k | 13.8 → 6.93 | 1302 → 1216 |
| golden | 1359 → **1127** (-17%) | 318k → 284k | 2.43 → 1.83 | 1108 → 1098 |
| night | 1085 → **1027** (-5%) | 269k → 277k | 3.73 → 2.25 | 1136 → 1102 |
| all 8 views | 8767 → **7932** (-10%) | | | |

**High** (`high`)

| view | draw calls before → after | triangles before → after | game JS ms/frame outside render, before → after | frame ms (software GL) before → after |
|---|---|---|---|---|
| town | 1399 → **1215** (-13%) | 325k → 330k | 8.28 → 7.68 | 1571 → 1330 |
| mainstreet | 1385 → **1106** (-20%) | 279k → 283k | 5.45 → 6.22 | 1692 → 1518 |
| lakeshore | 1233 → **1158** (-6%) | 273k → 275k | 6.55 → 4.98 | 1815 → 1845 |
| meadow | 1106 → **903** (-18%) | 260k → 268k | 4.53 → 4.23 | 1679 → 1667 |
| workshop | 1317 → **1317** (+0%) | 379k → 382k | 11 → 11.25 | 2308 → 2214 |
| northyard | 247 → **260** (+5%) | 211k → 214k | 8.73 → 11.03 | 1456 → 1610 |
| golden | 1411 → **1101** (-22%) | 289k → 291k | 2.55 → 1.88 | 1324 → 1287 |
| night | 1160 → **1066** (-8%) | 283k → 286k | 1.85 → 2.78 | 1339 → 1234 |
| all 8 views | 9258 → **8126** (-12%) | | | |
