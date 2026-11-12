# Credits

## Motion capture (Kelo-1's walk, run, turns, starting and stopping)

`js/kelo-mocap-data.js` was made from clips of the **CMU Graphics Lab Motion Capture Database**:

> The data used in this project was obtained from mocap.cs.cmu.edu.
> The database was created with funding from NSF EIA-0196217.

CMU's terms: "This data is free for use in research and commercial projects worldwide."

The clips came from the BVH conversion by Bruce Hahne (cgspeed, 2010 release), as mirrored at
https://github.com/una-dinosauria/cmu-mocap (its `READMEFIRST.txt` carries the terms above).
They were retargeted to Kelo-1's own joints and proportions offline: only the hip, knee, ankle,
shoulder, elbow and chest angles and the hip height are kept, one cycle each, resampled to about
30 samples a second and rounded. Clips used:

| Kelo-1's clip | CMU clip | Description in the CMU index |
| --- | --- | --- |
| walk | 16_15 | walk |
| stroll | 91_10 | SlowWalk |
| run | 16_35 | run/jog |
| turning as he walks | 16_11 | walk, veer left |
| turning on the spot | 69_16 | turn in place |
| setting off | 69_01 | walk forward |
| stopping | 16_33 | slow walk, stop |
