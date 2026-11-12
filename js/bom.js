// Kelo-bot-1 — js/bom.js
// Loaded after projects.js. Bills of materials for building anything from scratch, down to the screw.
// When Kelo-1 decides to build something big (an airplane, a go-kart, a canoe, a shed...), he
// researches it at NetNode and writes a real bill of materials (BOM): sub-assemblies, each with its
// parts, exact quantities and specs, the fasteners and consumables it eats, and the steps it takes.
//   - With an AI key the AI writes the BOM as strict JSON, which is validated and capped here.
//   - Without one he uses the built-in plans below for eight common builds.
// Each BOM line is [name, quantity, unit, kind, step?]: kind 'p' is a part, 'f' a fastener (counted
// down as he fits them), 'c' a consumable (used up: filler rod, glue, paint, fuel). The optional step
// names the verb of the step that uses the line up; otherwise bomLineStep() works it out.
// Steps are [verb, tool key, what he does]. The tools list says what each tool key is.
// js/assembly.js does the asking, receiving and building; js/buildmodels.js the 3D models.

const BOM_STEP_VERBS = ['cut', 'notch', 'drill', 'rivet', 'bolt', 'weld', 'glue', 'fit', 'swage', 'cover', 'sand', 'paint', 'wire', 'solder', 'fuel', 'inspect'];
const BOM_LIMITS = { subs: 12, lines: 30, steps: 8, tools: 24, skills: 10, tests: 5, qty: 100000, name: 80 };

// Weights (lb) and arms (inches aft of the wing leading edge) let him do a real weight-and-balance check
const BOM_TEMPLATES = {
  ultralight: {
    name: 'Ultralight airplane', item: 'Home-built ultralight airplane', emoji: '✈️', site: 'airfield', vehicle: 'plane',
    words: /\b(ultra-?light|air ?plane|aeroplane|kit ?plane|aircraft|plane|cessna|piper cub|bush plane)\b/i,
    wiki: ['Ultralight aviation', 'Aircraft fabric covering', 'Rotax 582'],
    summary: 'a single-seat, high-wing, tube-and-fabric basic ultralight: a welded 4130 steel fuselage, folding aluminium-spar wings covered in Ceconite, a Rotax 582 two-stroke turning a 68 in. propeller, 32 ft span, about 385 lb empty',
    subs: [
      { key: 'fuselage', name: 'Fuselage frame', weight: 64, arm: 42, stand: [-1.0, 1.4],
        lines: [
          ['4130 chromoly tube 1 in. × 0.035 in.', 24, 'ft', 'p'],
          ['4130 chromoly tube 7/8 in. × 0.035 in.', 40, 'ft', 'p'],
          ['4130 chromoly tube 3/4 in. × 0.035 in.', 80, 'ft', 'p'],
          ['4130 chromoly tube 5/8 in. × 0.035 in.', 40, 'ft', 'p'],
          ['4130 steel sheet 0.063 in. (gussets and tabs)', 4, 'sq ft', 'p'],
          ['4130 wing-attach fittings (machined)', 4, '', 'p'],
          ['Aluminium firewall 0.025 in.', 1, '', 'p'],
          ['AN3-5A bolts', 24, '', 'f', 'bolt'],
          ['AN365-1032 nylock nuts', 24, '', 'f', 'bolt'],
          ['AN960-10 washers', 48, '', 'f', 'bolt'],
          ['ER70S-2 TIG filler rod 1/16 in.', 2, 'lb', 'c', 'weld'],
          ['Argon shielding gas (80 cu ft cylinder)', 1, '', 'c', 'weld'],
          ['Linseed oil (inside the tubes)', 1, 'qt', 'c', 'paint'],
          ['Epoxy primer for steel tube', 1, 'gal', 'c', 'paint']
        ],
        steps: [
          ['cut', 'bandsaw', 'Cutting every tube to length from the drawings'],
          ['notch', 'notcher', 'Fish-mouthing the tube ends so each joint fits tight'],
          ['weld', 'tig', 'Tack-welding the sides in the jig, then full TIG welds all round'],
          ['bolt', 'wrench', 'Bolting on the wing-attach fittings and firewall'],
          ['inspect', null, 'Checking every weld for cracks, undercut and porosity'],
          ['paint', 'sprayGun', 'Oiling inside the tubes and spraying epoxy primer']
        ] },
      { key: 'gear', name: 'Landing gear', weight: 28, arm: -6, stand: [0.6, 1.6],
        lines: [
          ['Main gear legs, 4130 welded', 2, '', 'p'],
          ['Axles 3/4 in. 4130', 2, '', 'p'],
          ['Main wheels 6 in. with drum brakes', 2, '', 'p'],
          ['Tyres 15 × 6.00-6 with tubes', 2, '', 'p'],
          ['Bungee shock cord 5/8 in.', 12, 'ft', 'p'],
          ['Steerable tailwheel assembly 6 in.', 1, '', 'p'],
          ['Tailwheel leaf spring', 1, '', 'p'],
          ['Brake master cylinders', 2, '', 'p'],
          ['Nylon brake line 3/16 in.', 20, 'ft', 'p'],
          ['AN5-24A bolts (gear legs)', 4, '', 'f'],
          ['AN365-524 nylock nuts', 4, '', 'f'],
          ['AN3-7A bolts', 8, '', 'f'],
          ['AN365-1032 nylock nuts', 8, '', 'f'],
          ['MS24665-132 cotter pins', 4, '', 'f'],
          ['Brake fluid MIL-H-5606', 1, 'qt', 'c', 'fit'],
          ['Wheel-bearing grease', 1, 'tube', 'c', 'bolt']
        ],
        steps: [
          ['bolt', 'torque', 'Bolting the gear legs to the fuselage, torqued to spec'],
          ['bolt', 'wrench', 'Greasing the bearings and fitting axles, wheels and the tailwheel'],
          ['fit', 'wrench', 'Running the brake lines and bleeding the brakes'],
          ['inspect', null, 'Checking wheel alignment and that the brakes hold']
        ] },
      { key: 'tail', name: 'Tail surfaces', weight: 18, arm: 150, stand: [-4.0, 1.8],
        lines: [
          ['4130 chromoly tube 3/4 in. × 0.035 in.', 20, 'ft', 'p'],
          ['4130 chromoly tube 5/8 in. × 0.035 in.', 30, 'ft', 'p'],
          ['4130 chromoly tube 1/2 in. × 0.028 in.', 24, 'ft', 'p'],
          ['Hinge fittings 4130', 10, '', 'p'],
          ['Tail brace wires 1/8 in. with fork ends', 4, '', 'p'],
          ['AN155-8S turnbuckles', 4, '', 'p'],
          ['AN3-6A bolts', 16, '', 'f'],
          ['AN365-1032 nylock nuts', 16, '', 'f'],
          ['AN960-10 washers', 32, '', 'f'],
          ['ER70S-2 TIG filler rod 1/16 in.', 1, 'lb', 'c', 'weld'],
          ['Safety wire 0.032 in.', 0.25, 'lb', 'c', 'fit']
        ],
        steps: [
          ['cut', 'bandsaw', 'Cutting tube for the stabilizer, elevator, fin and rudder'],
          ['weld', 'tig', 'Welding the four tail surfaces flat on the table'],
          ['bolt', 'wrench', 'Hanging the surfaces on their hinges'],
          ['fit', 'safetyWire', 'Rigging the brace wires and safety-wiring the turnbuckles'],
          ['inspect', null, 'Checking the tail moves freely to its stops']
        ] },
      { key: 'wings', name: 'Wings (pair)', weight: 96, arm: 14, stand: [0.2, 4.2],
        lines: [
          ['6061-T6 aluminium spar tube 2 in. × 0.058 in.', 60, 'ft', 'p'],
          ['Pre-formed 6061-T6 wing ribs', 34, '', 'p'],
          ['2024-T3 aluminium sheet 0.016 in., 4 × 12 ft (leading edges)', 2, '', 'p'],
          ['Aluminium compression struts 3/4 in.', 12, '', 'p'],
          ['Drag and anti-drag wires 1/8 in. with fittings', 16, '', 'p'],
          ['Wing-tip bows', 2, '', 'p'],
          ['Flaperon frames (aluminium)', 2, '', 'p'],
          ['Streamlined 6061 lift struts', 4, '', 'p'],
          ['Jury struts', 4, '', 'p'],
          ['1/8 in. aluminium pop rivets', 2400, '', 'f'],
          ['AN3-5A bolts', 48, '', 'f'],
          ['AN365-1032 nylock nuts (rib fittings and struts)', 64, '', 'f'],
          ['AN4-11A bolts (spar attach)', 8, '', 'f'],
          ['AN365-428 nylock nuts', 8, '', 'f'],
          ['AN3-12A bolts (strut fittings)', 16, '', 'f'],
          ['AN960-416 washers', 16, '', 'f'],
          ['Zinc-chromate primer (aerosol)', 4, 'cans', 'c', 'drill']
        ],
        steps: [
          ['cut', 'bandsaw', 'Cutting the spar tubes to length and deburring them'],
          ['drill', 'drillPress', 'Drilling the spars for ribs and fittings (#30 for the 1/8 in. rivets)'],
          ['rivet', 'rivetGun', 'Clecoing each rib in place, then pulling the rivets'],
          ['fit', 'wrench', 'Fitting compression struts and drag wires, then squaring each wing'],
          ['bolt', 'torque', 'Hanging the wings and lift struts on the fuselage'],
          ['inspect', null, 'Checking every rivet head and the wing incidence']
        ] },
      { key: 'controls', name: 'Flight controls', weight: 14, arm: 30, stand: [-0.4, 1.3],
        lines: [
          ['Control stick (4130, with grip)', 1, '', 'p'],
          ['Torque tube 1-1/8 in. 4130', 1, '', 'p'],
          ['Rudder pedals', 1, 'set', 'p'],
          ['Flaperon push-pull tubes 6061 3/4 in.', 2, '', 'p'],
          ['Rod-end bearings 3/8 in. (HM-6)', 12, '', 'p'],
          ['7×19 galvanised control cable 1/8 in.', 100, 'ft', 'p'],
          ['AN210-2A pulleys', 8, '', 'p'],
          ['Throttle lever and cable', 1, '', 'p'],
          ['Seat sling and 4-point harness', 1, '', 'p'],
          ['Nicopress sleeves 1/8 in.', 32, '', 'f', 'swage'],
          ['AN100-4 thimbles', 32, '', 'f', 'swage'],
          ['AN3-10A bolts', 24, '', 'f'],
          ['AN365-1032 nylock nuts', 24, '', 'f'],
          ['MS24665-132 cotter pins', 30, '', 'f'],
          ['Safety wire 0.032 in.', 0.5, 'lb', 'c', 'fit']
        ],
        steps: [
          ['bolt', 'wrench', 'Installing the stick, torque tube, pedals and seat'],
          ['swage', 'swager', 'Swaging a Nicopress sleeve on every cable end'],
          ['fit', 'safetyWire', 'Tensioning the turnbuckles and safety-wiring them'],
          ['inspect', null, 'Full-and-free check of every control']
        ] },
      { key: 'covering', name: 'Fabric covering', weight: 32, arm: 40, stand: [-2.2, 1.6],
        lines: [
          ['Ceconite 102 fabric', 60, 'yd', 'p'],
          ['Poly-Fiber finishing tape 2 in.', 300, 'yd', 'p'],
          ['Rib-lacing cord', 500, 'ft', 'p'],
          ['Inspection rings', 24, '', 'p'],
          ['Drain grommets', 20, '', 'p'],
          ['Lexan windshield and windows 0.060 in.', 1, 'set', 'p'],
          ['Poly-Tak fabric cement', 1, 'gal', 'c', 'cover'],
          ['Poly-Brush sealer', 3, 'gal', 'c', 'paint'],
          ['Poly-Spray UV block (silver)', 3, 'gal', 'c', 'paint'],
          ['Poly-Tone topcoat (Cub yellow)', 3, 'gal', 'c', 'paint'],
          ['MEK reducer', 2, 'gal', 'c', 'paint']
        ],
        steps: [
          ['glue', null, 'Gluing the fabric to every frame with Poly-Tak'],
          ['cover', 'fabricIron', 'Shrinking the fabric drum-tight: 250, then 300, then 350 °F'],
          ['cover', null, 'Rib-lacing the fabric to every rib'],
          ['cover', 'fabricIron', 'Taping every rib and edge, and fitting the windshield'],
          ['paint', 'sprayGun', 'Spraying Poly-Brush, silver Poly-Spray, then yellow Poly-Tone'],
          ['inspect', null, 'Checking the fabric tension and for any pinholes']
        ] },
      { key: 'engine', name: 'Engine and propeller', weight: 98, arm: -38, stand: [2.4, 1.2],
        lines: [
          ['Rotax 582 engine (dual CDI, B gearbox 2.58:1)', 1, '', 'p'],
          ['Engine mount, 4130 welded', 1, '', 'p'],
          ['Lord rubber mount isolators', 4, '', 'p'],
          ['68 in. two-blade propeller', 1, '', 'p'],
          ['Propeller spinner 9 in.', 1, '', 'p'],
          ['Radiator (twin core)', 1, '', 'p'],
          ['Coolant hose 1 in.', 6, 'ft', 'p'],
          ['Tuned exhaust with muffler', 1, '', 'p'],
          ['Spark plugs NGK BR8ECS', 4, '', 'p'],
          ['M8 propeller bolts with lock nuts', 6, '', 'f'],
          ['AN5-14A bolts (engine mount)', 4, '', 'f'],
          ['AN365-524 nylock nuts', 4, '', 'f'],
          ['Worm-drive hose clamps', 12, '', 'f', 'fit'],
          ['Exhaust springs', 6, '', 'f', 'fit'],
          ['Engine coolant 50/50', 1, 'gal', 'c', 'fit'],
          ['Two-stroke injection oil', 2, 'qt', 'c', 'fit'],
          ['Gearbox oil', 1, 'pt', 'c', 'fit']
        ],
        steps: [
          ['bolt', 'torque', 'Hanging the engine on its mount and Lord isolators'],
          ['fit', 'wrench', 'Plumbing the radiator and exhaust, then filling coolant and oil'],
          ['bolt', 'torque', 'Fitting the 68 in. propeller, torquing the bolts in a star pattern'],
          ['inspect', null, 'Checking the prop track: both tips within 1/8 in.']
        ] },
      { key: 'fuel', name: 'Fuel system', weight: 12, arm: 20, stand: [0.2, 1.4],
        lines: [
          ['Aluminium wing-root fuel tanks, 5 gal', 2, '', 'p'],
          ['SAE J30R7 fuel hose 1/4 in.', 20, 'ft', 'p'],
          ['Fuel shutoff valve', 1, '', 'p'],
          ['Gascolator (fuel filter)', 1, '', 'p'],
          ['Mikuni pulse fuel pump', 1, '', 'p'],
          ['Primer bulb', 1, '', 'p'],
          ['Fuel sight gauges', 2, '', 'p'],
          ['Fuel-hose clamps', 16, '', 'f'],
          ['Premium unleaded fuel (91 octane)', 10, 'gal', 'c', 'fuel']
        ],
        steps: [
          ['fit', 'wrench', 'Mounting the tanks in the wing roots'],
          ['fit', null, 'Running the fuel lines with gentle bends and no low spots'],
          ['inspect', null, 'Leak-testing the fuel system'],
          ['fuel', null, 'Filling the tanks with 91-octane fuel']
        ] },
      { key: 'instruments', name: 'Instruments', weight: 8, arm: 18, stand: [1.4, 1.4],
        lines: [
          ['Airspeed indicator 0–100 mph, 2-1/4 in.', 1, '', 'p'],
          ['Altimeter 2-1/4 in.', 1, '', 'p'],
          ['Tachometer (Rotax)', 1, '', 'p'],
          ['Dual EGT gauge with probes', 1, '', 'p'],
          ['Coolant-temperature gauge', 1, '', 'p'],
          ['Compass', 1, '', 'p'],
          ['Slip indicator', 1, '', 'p'],
          ['Pitot tube', 1, '', 'p'],
          ['Pitot-static tubing 3/16 in.', 15, 'ft', 'p'],
          ['Instrument panel, 6061 0.063 in.', 1, '', 'p'],
          ['#6-32 panel screws', 24, '', 'f'],
          ['#6-32 nylock nuts', 24, '', 'f']
        ],
        steps: [
          ['drill', 'drillPress', 'Cutting the instrument holes in the panel'],
          ['fit', 'screwdriver', 'Mounting the gauges and the pitot tube'],
          ['inspect', null, 'Leak-checking the pitot-static lines']
        ] },
      { key: 'electrical', name: 'Electrical system', weight: 16, arm: -10, stand: [1.0, 1.5],
        lines: [
          ['12 V AGM battery, 9 Ah', 1, '', 'p'],
          ['Battery master switch', 1, '', 'p'],
          ['Ignition kill switches', 2, '', 'p'],
          ['Starter solenoid', 1, '', 'p'],
          ['Rotax voltage regulator', 1, '', 'p'],
          ['6-way blade fuse block', 1, '', 'p'],
          ['LED nav and strobe light set', 1, '', 'p'],
          ['Tefzel wire 18 AWG', 100, 'ft', 'p'],
          ['Wire 10 AWG', 15, 'ft', 'p'],
          ['Battery cable 4 AWG', 8, 'ft', 'p'],
          ['Crimp ring terminals', 100, '', 'f', 'wire'],
          ['Nylon cable ties', 200, '', 'f', 'wire'],
          ['Heat-shrink tubing', 1, 'kit', 'c', 'wire']
        ],
        steps: [
          ['wire', 'crimper', 'Crimping terminals and running the wiring harness'],
          ['wire', 'multimeter', 'Checking every circuit with the multimeter'],
          ['inspect', null, 'Testing the master, starter and both ignition switches']
        ] }
    ],
    tools: [
      ['tig', 'TIG welder (AC/DC, 200 A)', 'tig|welder', 'to weld the 4130 fuselage and tail'],
      ['bandsaw', 'Metal-cutting bandsaw', 'band ?saw|hacksaw', 'to cut tube and spars to length'],
      ['notcher', 'Tube notcher (hole-saw type)', 'notcher', 'to fish-mouth the tube ends'],
      ['drillPress', 'Drill press', 'drill press', 'to drill spars and panel holes square'],
      ['rivetGun', 'Pneumatic pop-rivet gun', 'rivet', 'to pull 2,400 rivets'],
      ['clecos', 'Cleco fasteners 1/8 in. (100) with cleco pliers', 'cleco', 'to hold ribs while riveting'],
      ['torque', 'Torque wrench (inch-pounds)', 'torque wrench', 'to torque every AN bolt to spec'],
      ['wrench', 'Combination wrench set (3/8–3/4 in.)', 'wrench|spanner', 'for every nut and bolt'],
      ['swager', 'Nicopress swaging tool', 'nicopress|swag', 'to swage the control cables'],
      ['safetyWire', 'Safety-wire pliers', 'safety.?wire|pliers', 'to safety-wire turnbuckles'],
      ['fabricIron', 'Calibrated fabric iron', 'iron', 'to shrink the Ceconite'],
      ['sprayGun', 'HVLP spray gun', 'spray gun|hvlp', 'to spray primer and Poly-Fiber coats'],
      ['crimper', 'Ratcheting wire crimper', 'crimp', 'to crimp the electrical terminals'],
      ['multimeter', 'Digital multimeter', 'multimeter', 'to check the wiring'],
      ['screwdriver', 'Screwdriver set', 'screwdriver', 'to mount the instruments'],
      ['scales', 'Aircraft weighing scales (3-pad)', 'scales?\\b', 'for the weight-and-balance check']
    ],
    skills: ['TIG welding thin-wall 4130 tube', 'Sheet-metal work and riveting', 'Fabric covering (Poly-Fiber process)', 'Control-cable rigging and safety wiring',
      'Engine installation and run-up', 'Aircraft wiring', 'Weight and balance', 'Flying (ground school, taxi practice, then flight)'],
    tests: [
      ['wb', 'Weight and balance', 'Weigh it on three scales and work out the empty weight and centre of gravity'],
      ['controls', 'Control and rigging check', 'Full and free movement, correct direction, cable tension'],
      ['runup', 'Engine run-up', 'Warm up, check both ignitions, full-power static rpm, temperatures']
    ],
    // Centre-of-gravity limits (inches aft of the leading edge), the pilot and fuel for the loaded case
    cg: { min: 11, max: 19, pilot: 170, pilotArm: 30, fuelLb: 60, fuelArm: 20, maxGross: 1200 }
  },

  gokart: {
    name: 'Go-kart', item: 'Home-built go-kart', emoji: '🏎️', site: 'bench', vehicle: 'kart',
    words: /\bgo-?karts?\b|\bkarts?\b|\bkarting\b/i,
    wiki: ['Kart racing', 'Go-kart'],
    summary: 'a welded steel-tube fun kart with a 212 cc (6.5 hp) engine, centrifugal clutch and #35 chain, a live rear axle with a disc brake, and Ackermann steering',
    subs: [
      { key: 'frame', name: 'Frame', weight: 38, stand: [0, 1.0],
        lines: [
          ['DOM mild-steel tube 1 in. × 0.065 in.', 40, 'ft', 'p'],
          ['DOM mild-steel tube 3/4 in. × 0.065 in.', 16, 'ft', 'p'],
          ['Steel plate 3/16 in. (mounts)', 2, 'sq ft', 'p'],
          ['16-gauge steel floor pan', 4, 'sq ft', 'p'],
          ['ER70S-6 MIG wire 0.030 in.', 2, 'lb', 'c', 'weld'],
          ['75/25 argon-CO2 gas (40 cu ft)', 1, '', 'c', 'weld'],
          ['Cut-off and flap discs', 6, '', 'c', 'cut'],
          ['Rattle-can primer and enamel', 4, 'cans', 'c', 'paint']
        ],
        steps: [
          ['cut', 'chopSaw', 'Cutting the frame rails and cross members'],
          ['notch', 'grinder', 'Notching the tube ends and grinding them to fit'],
          ['weld', 'mig', 'Tacking the frame square on the table, then MIG welding it'],
          ['inspect', null, 'Checking the frame is flat and square corner to corner'],
          ['paint', null, 'Priming and painting the frame']
        ] },
      { key: 'steering', name: 'Steering', weight: 9, stand: [0.8, 1.0],
        lines: [
          ['Steering wheel 11 in. with hub', 1, '', 'p'],
          ['Steering shaft 3/4 in.', 1, '', 'p'],
          ['Steering-shaft flange bearings', 2, '', 'p'],
          ['Kingpin spindles (pair)', 1, 'set', 'p'],
          ['Tie rods 5/16 in.', 2, '', 'p'],
          ['Heim joints 5/16 in.', 4, '', 'p'],
          ['Grade 8 bolts 5/16-18', 16, '', 'f'],
          ['Nylock nuts 5/16-18', 16, '', 'f']
        ],
        steps: [
          ['bolt', 'socket', 'Bolting in the steering shaft, spindles and tie rods'],
          ['fit', 'tape', 'Setting 1/8 in. of toe-in'],
          ['inspect', null, 'Checking full lock both ways without binding']
        ] },
      { key: 'axle', name: 'Rear axle and brake', weight: 22, stand: [-0.9, 1.0],
        lines: [
          ['Keyed live axle 1 in. × 36 in.', 1, '', 'p'],
          ['Pillow-block bearings 1 in.', 3, '', 'p'],
          ['Brake disc 6 in. with hub', 1, '', 'p'],
          ['Mechanical disc-brake caliper', 1, '', 'p'],
          ['Brake pedal and cable', 1, '', 'p'],
          ['#35 sprocket 60-tooth with hub', 1, '', 'p'],
          ['Keyed wheel hubs 1 in.', 2, '', 'p'],
          ['Set screws 5/16 in.', 8, '', 'f'],
          ['Grade 8 bolts 3/8-16', 10, '', 'f'],
          ['Nylock nuts 3/8-16', 10, '', 'f']
        ],
        steps: [
          ['bolt', 'socket', 'Bolting the bearings in line and sliding the axle through'],
          ['fit', 'socket', 'Fitting the brake disc, caliper and sprocket'],
          ['inspect', null, 'Spinning the axle: true, smooth, and the brake grabs']
        ] },
      { key: 'wheels', name: 'Wheels and tyres', weight: 20, stand: [0, 1.4],
        lines: [
          ['Front tyres 10 × 4.50-5 on rims', 2, '', 'p'],
          ['Rear tyres 11 × 7.10-5 on rims', 2, '', 'p'],
          ['Front wheel bearings 5/8 in.', 4, '', 'p'],
          ['Lug bolts 5/16 in.', 12, '', 'f'],
          ['Axle nuts and cotter pins', 4, 'sets', 'f']
        ],
        steps: [
          ['bolt', 'socket', 'Mounting the four wheels'],
          ['inspect', null, 'Setting the tyres to 12 psi and checking for wobble']
        ] },
      { key: 'engine', name: 'Engine and drive', weight: 38, stand: [-0.8, 1.0],
        lines: [
          ['212 cc (6.5 hp) OHV engine', 1, '', 'p'],
          ['Centrifugal clutch 3/4 in., 12-tooth #35', 1, '', 'p'],
          ['#35 roller chain', 10, 'ft', 'p'],
          ['Engine mount plate', 1, '', 'p'],
          ['Throttle pedal and cable', 1, '', 'p'],
          ['Chain guard', 1, '', 'p'],
          ['Kill switch', 1, '', 'p'],
          ['Grade 8 bolts 3/8-16 (engine)', 4, '', 'f'],
          ['Engine oil 10W-30', 0.6, 'qt', 'c', 'fuel'],
          ['Regular gasoline', 1, 'gal', 'c', 'fuel']
        ],
        steps: [
          ['bolt', 'socket', 'Bolting the engine down and lining up the sprockets'],
          ['fit', 'socket', 'Fitting the chain, guard, throttle and kill switch'],
          ['fuel', null, 'Oil in, fuel in']
        ] },
      { key: 'seat', name: 'Seat and body', weight: 12, stand: [0, -1.0],
        lines: [
          ['Moulded kart seat', 1, '', 'p'],
          ['Seat struts', 4, '', 'p'],
          ['Front bumper and nerf bars', 1, 'set', 'p'],
          ['M8 bolts with nylock nuts (seat)', 8, '', 'f']
        ],
        steps: [
          ['drill', 'drill', 'Drilling the seat for its struts'],
          ['bolt', 'socket', 'Bolting in the seat, bumper and nerf bars'],
          ['inspect', null, 'Sitting in it: pedals in reach, nothing sharp']
        ] }
    ],
    tools: [
      ['mig', 'MIG welder (140 A)', 'mig|welder', 'to weld the frame'],
      ['chopSaw', 'Abrasive chop saw', 'chop ?saw|band ?saw|hacksaw', 'to cut tube'],
      ['grinder', 'Angle grinder', 'grinder', 'to notch and clean the welds'],
      ['drill', 'Cordless drill', 'drill(?! press)', 'to drill mounting holes'],
      ['socket', 'Socket and wrench set', 'socket|wrench', 'for every bolt'],
      ['tape', 'Tape measure', 'tape measure', 'to set toe-in and square']
    ],
    skills: ['MIG welding mild steel', 'Measuring and squaring a frame', 'Steering geometry (toe-in)', 'Chain drives and clutches'],
    tests: [
      ['brakes', 'Brake test', 'Push it at walking pace and stop it with the pedal'],
      ['steer', 'Steering and alignment check', 'Full lock both ways, toe-in 1/8 in.'],
      ['start', 'Engine start and throttle return', 'It starts, idles without moving, and the throttle snaps back']
    ]
  },

  canoe: {
    name: 'Cedar-strip canoe', item: 'Cedar-strip canoe', emoji: '🛶', site: 'beach', vehicle: 'boat',
    words: /\bcanoes?\b/i,
    wiki: ['Strip-built boat', 'Canoe'],
    summary: 'a 16 ft cedar-strip canoe: western red cedar bead-and-cove strips over station molds, sheathed in 6 oz fibreglass and epoxy inside and out, with ash gunwales, cane seats and a carry yoke',
    subs: [
      { key: 'forms', name: 'Strongback and forms', weight: 0, stand: [0, 1.0],
        lines: [
          ['3/4 in. plywood 4 × 8 ft (strongback)', 2, 'sheets', 'p'],
          ['1/2 in. particleboard 4 × 8 ft (station molds)', 2, 'sheets', 'p'],
          ['2 × 4 lumber 8 ft', 6, '', 'p'],
          ['Drywall screws 1-5/8 in.', 200, '', 'f'],
          ['Packing tape (mold edges)', 2, 'rolls', 'c', 'fit']
        ],
        steps: [
          ['cut', 'jigsaw', 'Cutting out the 15 station molds from the plans'],
          ['fit', 'drill', 'Screwing the molds to the strongback, lined up with a string'],
          ['inspect', null, 'Sighting along the molds for a fair curve']
        ] },
      { key: 'strips', name: 'Hull stripping', weight: 34, stand: [0, 1.0],
        lines: [
          ['Western red cedar strips 1/4 × 3/4 in. bead-and-cove, 17 ft', 70, '', 'p'],
          ['Ash inner and outer stems', 4, '', 'p'],
          ['Staples 9/16 in. (pulled later)', 1000, '', 'f'],
          ['Titebond III wood glue', 1, 'qt', 'c', 'glue']
        ],
        steps: [
          ['fit', 'plane', 'Bending in the stems and fairing them'],
          ['glue', 'stapler', 'Gluing and stapling strips up from the sheer, one each side in turn'],
          ['sand', 'sander', 'Pulling the staples and fairing the hull with a plane and sander'],
          ['inspect', null, 'Running a hand along it for flat spots']
        ] },
      { key: 'glass', name: 'Fibreglass and epoxy', weight: 14, stand: [0, 1.0],
        lines: [
          ['6 oz E-glass cloth 50 in. wide', 12, 'yd', 'p'],
          ['Fibreglass bias tape 3 in.', 10, 'yd', 'p'],
          ['Epoxy resin and hardener', 3, 'gal', 'c', 'cover'],
          ['Sandpaper 80, 120 and 220 grit', 50, 'sheets', 'c', 'sand']
        ],
        steps: [
          ['cover', 'squeegee', 'Wetting out the outside glass with epoxy'],
          ['sand', 'sander', 'Lifting the hull off the forms and sanding the inside'],
          ['cover', 'squeegee', 'Glassing the inside'],
          ['inspect', null, 'Checking for dry spots and bubbles in the glass']
        ] },
      { key: 'outfit', name: 'Gunwales, seats and yoke', weight: 12, stand: [0, 1.0],
        lines: [
          ['Ash gunwale strips 3/4 × 1 in., 17 ft', 4, '', 'p'],
          ['Ash cane seats', 2, '', 'p'],
          ['Ash carry yoke', 1, '', 'p'],
          ['Ash thwarts', 2, '', 'p'],
          ['Cherry deck plates', 2, '', 'p'],
          ['Brass stem bands 3/8 in.', 2, '', 'p'],
          ['Silicon-bronze screws #8 × 1-1/4 in.', 120, '', 'f'],
          ['Stainless carriage bolts 3/16 in. with nuts', 16, '', 'f']
        ],
        steps: [
          ['drill', 'drill', 'Drilling and screwing on the inwales and outwales'],
          ['bolt', 'drill', 'Hanging the seats, thwarts and yoke'],
          ['inspect', null, 'Lifting it by the yoke: it balances level']
        ] },
      { key: 'finish', name: 'Varnish', weight: 2, stand: [0, 1.0],
        lines: [
          ['Spar varnish (UV)', 1, 'qt', 'c', 'paint'],
          ['Foam brushes', 10, '', 'c', 'paint']
        ],
        steps: [
          ['sand', 'sander', 'Sanding the epoxy to a dull, even finish'],
          ['paint', null, 'Three coats of spar varnish'],
          ['inspect', null, 'Looking it over in the light']
        ] }
    ],
    tools: [
      ['tablesaw', 'Table saw (for ripping strips)', 'table saw', 'to rip the cedar strips'],
      ['jigsaw', 'Jigsaw', 'jig ?saw', 'to cut the station molds'],
      ['plane', 'Block plane', 'plane\\b', 'to fair the stems and strips'],
      ['stapler', 'Staple gun', 'staple', 'to hold strips while the glue dries'],
      ['sander', 'Random-orbit sander', 'sander', 'to fair the hull'],
      ['squeegee', 'Epoxy squeegees and roller', 'squeegee|roller', 'to wet out the glass'],
      ['drill', 'Cordless drill', 'drill(?! press)', 'for the forms and gunwales'],
      ['clamps', 'Spring clamps (24)', 'clamps?', 'to hold the gunwales']
    ],
    skills: ['Lofting and station molds', 'Strip-planking', 'Fibreglass and epoxy work', 'Fine woodworking'],
    tests: [['float', 'Float test', 'Into the shallows: no leaks, sits level'], ['weigh', 'Weigh the hull', 'A good strip canoe is about 55–65 lb']]
  },

  shed: {
    name: 'Garden shed', item: 'Garden shed', emoji: '🛖', site: 'spot', vehicle: null, r: 3.4,
    words: /\b(garden |tool |storage )?sheds?\b/i,
    wiki: ['Shed', 'Framing (construction)'],
    summary: 'an 8 × 10 ft gable-roof shed: pressure-treated skids on deck blocks, a 2 × 6 floor, 2 × 4 walls 16 in. on centre, T1-11 siding, an OSB roof under asphalt shingles, a double door and a window',
    subs: [
      { key: 'foundation', name: 'Foundation', weight: 0, stand: [0, 2.6],
        lines: [
          ['Concrete deck blocks', 9, '', 'p'],
          ['Pressure-treated 4 × 4 skids, 10 ft', 3, '', 'p'],
          ['3/4 in. crushed gravel', 1, 'cu yd', 'c', 'fit']
        ],
        steps: [['fit', 'shovel', 'Levelling a gravel pad and setting the deck blocks'], ['fit', 'level', 'Laying the skids level and parallel'], ['inspect', 'level', 'Checking level both ways']] },
      { key: 'floor', name: 'Floor', weight: 0, stand: [0, 2.6],
        lines: [
          ['Pressure-treated 2 × 6 joists, 8 ft', 9, '', 'p'],
          ['Pressure-treated 2 × 6 rim joists, 10 ft', 2, '', 'p'],
          ['3/4 in. tongue-and-groove plywood 4 × 8', 3, 'sheets', 'p'],
          ['16d galvanised framing nails', 200, '', 'f'],
          ['Deck screws 1-5/8 in.', 200, '', 'f']
        ],
        steps: [['cut', 'circSaw', 'Cutting the joists'], ['fit', 'hammer', 'Nailing the floor frame 16 in. on centre'], ['fit', 'drill', 'Screwing down the plywood'], ['inspect', 'tape', 'Measuring diagonals: square to 1/8 in.']] },
      { key: 'walls', name: 'Wall framing', weight: 0, stand: [0, 2.6],
        lines: [
          ['2 × 4 studs, 8 ft', 40, '', 'p'],
          ['2 × 4 plates, 10 ft', 8, '', 'p'],
          ['2 × 6 door and window headers, 8 ft', 2, '', 'p'],
          ['16d framing nails', 600, '', 'f']
        ],
        steps: [['cut', 'circSaw', 'Cutting studs, plates and headers'], ['fit', 'hammer', 'Framing each wall flat on the floor'], ['fit', 'hammer', 'Raising the walls, plumbing and bracing them'], ['inspect', 'level', 'Checking plumb at every corner']] },
      { key: 'roofframe', name: 'Roof framing', weight: 0, stand: [0, 2.6],
        lines: [
          ['2 × 4 rafters, 8 ft', 16, '', 'p'],
          ['2 × 6 ridge board, 10 ft', 1, '', 'p'],
          ['Hurricane ties', 16, '', 'p'],
          ['Connector nails 1-1/2 in.', 160, '', 'f'],
          ['16d framing nails', 100, '', 'f']
        ],
        steps: [['cut', 'circSaw', 'Cutting the birdsmouth and plumb cuts on a pattern rafter'], ['fit', 'hammer', 'Setting the ridge and nailing the rafters in pairs'], ['inspect', null, 'Sighting the ridge for sag']] },
      { key: 'roofing', name: 'Roofing', weight: 0, stand: [0, 2.6],
        lines: [
          ['7/16 in. OSB sheathing 4 × 8', 6, 'sheets', 'p'],
          ['#15 roofing felt', 1, 'roll', 'p'],
          ['Drip edge, 10 ft', 6, '', 'p'],
          ['Asphalt shingles (bundles)', 4, '', 'p'],
          ['Ridge-cap shingles (bundle)', 1, '', 'p'],
          ['Roofing nails 1-1/4 in.', 1000, '', 'f'],
          ['8d sheathing nails', 300, '', 'f']
        ],
        steps: [['fit', 'hammer', 'Nailing on the OSB sheathing'], ['cover', 'stapler', 'Rolling out felt and fitting the drip edge'], ['cover', 'hammer', 'Shingling from the bottom course up'], ['inspect', null, 'Hosing the roof: no drips inside']] },
      { key: 'siding', name: 'Siding, door and window', weight: 0, stand: [0, 2.6],
        lines: [
          ['T1-11 siding panels 4 × 8', 10, '', 'p'],
          ['House wrap', 1, 'roll', 'p'],
          ['1 × 4 trim boards, 8 ft', 12, '', 'p'],
          ['Window 24 × 36 in.', 1, '', 'p'],
          ['Strap hinges 8 in.', 6, '', 'p'],
          ['Hasp and padlock', 1, '', 'p'],
          ['8d galvanised siding nails', 600, '', 'f'],
          ['Exterior caulk', 4, 'tubes', 'c', 'fit']
        ],
        steps: [['cut', 'circSaw', 'Cutting the siding around the door and window'], ['fit', 'hammer', 'Nailing on the siding and trim'], ['fit', 'drill', 'Hanging the double doors and the window'], ['inspect', null, 'Swinging the doors: no rubbing']] },
      { key: 'paint', name: 'Paint', weight: 0, stand: [0, 2.6],
        lines: [['Exterior primer', 1, 'gal', 'c', 'paint'], ['Exterior paint (barn green)', 2, 'gal', 'c', 'paint'], ['Trim paint (white)', 1, 'qt', 'c', 'paint']],
        steps: [['paint', null, 'Priming the bare wood'], ['paint', null, 'Two coats of green, white trim'], ['inspect', null, 'Touching up the drips']] }
    ],
    tools: [
      ['circSaw', 'Circular saw', 'circular saw|\\bsaw\\b', 'to cut the framing'],
      ['hammer', 'Framing hammer', '^(?!.*jack ?hammer).*hammer', 'to nail the frame'],
      ['drill', 'Cordless drill', 'drill(?! press)', 'for screws'],
      ['level', '4 ft level', '\\blevel\\b', 'to keep it level and plumb'],
      ['tape', 'Tape measure', 'tape measure', 'to measure everything twice'],
      ['shovel', 'Shovel', 'shovel|spade', 'to level the gravel pad'],
      ['stapler', 'Hammer stapler', 'staple', 'for the roofing felt']
    ],
    skills: ['Framing', 'Roofing', 'Siding and trim', 'Reading a level and a square'],
    tests: [['square', 'Square and level check', 'Diagonals equal, floor level, walls plumb'], ['water', 'Water test', 'A hose on the roof: dry inside']]
  },

  drone: {
    name: 'Quadcopter drone', item: 'Home-built FPV quadcopter', emoji: '🛸', site: 'bench', vehicle: null, itemKind: 'tool',
    words: /\b(drones?|quad-?copters?|multi-?rotors?|fpv)\b/i,
    wiki: ['Quadcopter', 'First-person view (radio control)'],
    summary: 'a 5 in. FPV quadcopter: a 220 mm carbon-fibre frame, four 2306 brushless motors on a 4-in-1 ESC, an F7 flight controller running Betaflight, ELRS radio and 5.8 GHz video, on a 4S LiPo',
    subs: [
      { key: 'frame', name: 'Frame', weight: 0, stand: [0, 1.1],
        lines: [['5 in. carbon-fibre frame kit (220 mm)', 1, '', 'p'], ['M3 standoffs', 4, '', 'p'], ['M3 × 8 mm frame screws', 12, '', 'f'], ['M3 nylock nuts', 8, '', 'f']],
        steps: [['bolt', 'hex', 'Bolting the arms between the carbon plates'], ['inspect', null, 'Checking for loose screws and frayed carbon']] },
      { key: 'power', name: 'Motors and ESC', weight: 0, stand: [0, 1.1],
        lines: [['2306 2450 KV brushless motors', 4, '', 'p'], ['4-in-1 45 A BLHeli_32 ESC', 1, '', 'p'], ['XT60 battery lead', 1, '', 'p'], ['Low-ESR capacitor 35 V 1,000 µF', 1, '', 'p'],
          ['12 AWG silicone wire', 3, 'ft', 'p'], ['M3 × 6 mm motor screws', 16, '', 'f'], ['60/40 rosin-core solder', 1, 'roll', 'c', 'solder'], ['Flux pen', 1, '', 'c', 'solder']],
        steps: [['bolt', 'hex', 'Screwing the motors to the arms'], ['solder', 'iron', 'Soldering the motor wires, battery lead and capacitor to the ESC'], ['inspect', 'multimeter', 'Checking for shorts with the multimeter']] },
      { key: 'brain', name: 'Flight controller', weight: 0, stand: [0, 1.1],
        lines: [['F7 flight controller (30 × 30)', 1, '', 'p'], ['Rubber soft-mount grommets', 8, '', 'p'], ['M3 nylon nuts', 4, '', 'f']],
        steps: [['fit', 'hex', 'Stacking the flight controller on soft mounts'], ['wire', 'iron', 'Connecting it to the ESC and flashing Betaflight']] },
      { key: 'radio', name: 'Radio and video', weight: 0, stand: [0, 1.1],
        lines: [['ELRS 2.4 GHz receiver', 1, '', 'p'], ['ELRS radio transmitter', 1, '', 'p'], ['FPV camera (micro, 1200TVL)', 1, '', 'p'], ['5.8 GHz video transmitter 25–800 mW', 1, '', 'p'],
          ['RHCP antenna', 1, '', 'p'], ['FPV goggles', 1, '', 'p'], ['Heat-shrink tubing', 1, 'kit', 'c', 'solder'], ['Zip ties', 20, '', 'f', 'fit']],
        steps: [['solder', 'iron', 'Soldering on the receiver, camera and video transmitter'], ['fit', null, 'Mounting the camera at 30° and zip-tying the antennas'], ['wire', null, 'Binding the receiver to the radio']] },
      { key: 'props', name: 'Battery and props', weight: 0, stand: [0, 1.1],
        lines: [['4S LiPo 1,500 mAh 100C', 3, '', 'p'], ['5 × 4.3 × 3 tri-blade propellers', 8, '', 'p'], ['Battery straps', 2, '', 'p'], ['M5 prop nuts', 4, '', 'f']],
        steps: [['inspect', 'multimeter', 'Smoke-stopper power-up and checking motor direction, props off'], ['bolt', 'propWrench', 'Fitting props the right way round'], ['inspect', null, 'Setting the failsafe and arming checks']] }
    ],
    tools: [
      ['iron', 'Temperature-controlled soldering iron (60 W)', 'soldering', 'for every joint'],
      ['hex', 'Hex drivers 1.5, 2, 2.5 mm', 'hex', 'for the M2/M3 screws'],
      ['multimeter', 'Digital multimeter', 'multimeter', 'to check for shorts'],
      ['propWrench', 'Prop wrench', 'prop wrench|wrench', 'for the prop nuts'],
      ['charger', 'LiPo balance charger', 'charger', 'to charge the batteries safely']
    ],
    skills: ['Soldering', 'Betaflight setup', 'Radio binding and failsafes', 'Flying FPV'],
    tests: [['smoke', 'Smoke-stopper test', 'First power-up through a fuse: nothing gets hot'], ['motors', 'Motor direction and failsafe test', 'Props off: each motor spins the right way; failsafe drops it'], ['hover', 'Hover test', 'A gentle hover at knee height']]
  },

  guitar: {
    name: 'Electric guitar', item: 'Home-built electric guitar', emoji: '🎸', site: 'bench', vehicle: null, itemKind: 'toy',
    words: /\b(electric )?guitars?\b/i,
    wiki: ['Electric guitar', 'Luthier'],
    summary: 'a solid-body electric guitar with an alder body, a bolt-on maple neck and rosewood fingerboard (25.5 in. scale, 22 frets), three single-coil pickups and a vintage tremolo, finished in nitro lacquer',
    subs: [
      { key: 'body', name: 'Body', weight: 0, stand: [0, 1.0],
        lines: [['Alder body blank 14 × 20 × 1-3/4 in.', 1, '', 'p'], ['MDF body and routing templates', 1, 'set', 'p'], ['Double-sided tape', 1, 'roll', 'c', 'cut']],
        steps: [['cut', 'bandsaw', 'Bandsawing the body outline'], ['cut', 'router', 'Routing the pickup and control cavities and the neck pocket'], ['sand', 'sander', 'Rounding the edges and sanding the body']] },
      { key: 'neck', name: 'Neck and fingerboard', weight: 0, stand: [0, 1.0],
        lines: [['Hard maple neck blank 1 × 3-1/2 × 26 in.', 1, '', 'p'], ['Rosewood fingerboard, slotted 25.5 in., 9.5 in. radius', 1, '', 'p'],
          ['Dual-action truss rod 18 in.', 1, '', 'p'], ['Pearl dot inlays 1/4 in.', 12, '', 'p'], ['Titebond wood glue', 1, 'bottle', 'c', 'glue']],
        steps: [['cut', 'router', 'Routing the truss-rod slot'], ['glue', 'clamps', 'Gluing on the fingerboard with the dots inlaid'], ['cut', 'bandsaw', 'Shaping the headstock and carving the neck back']] },
      { key: 'frets', name: 'Frets and nut', weight: 0, stand: [0, 1.0],
        lines: [['Medium-jumbo fret wire', 2, 'ft', 'p'], ['Bone nut', 1, '', 'p'], ['Fret-end files and crowning (sandpaper 400–1,000)', 10, 'sheets', 'c', 'sand']],
        steps: [['fit', 'fretHammer', 'Pressing in all 22 frets'], ['sand', 'fretFile', 'Levelling, crowning and dressing the frets'], ['fit', 'fretFile', 'Cutting the nut slots']] },
      { key: 'finish', name: 'Finish', weight: 0, stand: [0, 1.0],
        lines: [['Grain filler', 1, 'pt', 'c', 'sand'], ['Sanding sealer (aerosol)', 2, 'cans', 'c', 'paint'], ['Nitrocellulose lacquer, red (aerosol)', 6, 'cans', 'c', 'paint'],
          ['Clear nitro lacquer (aerosol)', 4, 'cans', 'c', 'paint'], ['Tru-Oil (neck)', 1, 'bottle', 'c', 'paint'], ['Sandpaper 320–2,000 grit', 30, 'sheets', 'c', 'sand']],
        steps: [['sand', 'sander', 'Filling the grain and sealing'], ['paint', null, 'Spraying red, then clear coats'], ['sand', null, 'Wet-sanding and buffing to a gloss']] },
      { key: 'hardware', name: 'Hardware', weight: 0, stand: [0, 1.0],
        lines: [['Vintage tremolo bridge (6-screw)', 1, '', 'p'], ['Tuners (set of 6)', 1, 'set', 'p'], ['String trees', 2, '', 'p'], ['Strap buttons', 2, '', 'p'], ['Neck plate', 1, '', 'p'],
          ['Tremolo springs and claw', 1, 'set', 'p'], ['Neck bolts #8 × 2 in.', 4, '', 'f'], ['Bridge screws', 6, '', 'f'], ['Pickguard screws', 11, '', 'f']],
        steps: [['drill', 'drillPress', 'Drilling the neck-bolt, bridge and tuner holes'], ['bolt', 'screwdriver', 'Bolting on the neck and fitting bridge, tuners and buttons']] },
      { key: 'electronics', name: 'Electronics', weight: 0, stand: [0, 1.0],
        lines: [['Single-coil pickups', 3, '', 'p'], ['5-way blade switch', 1, '', 'p'], ['250 kΩ potentiometers', 3, '', 'p'], ['0.022 µF tone capacitor', 1, '', 'p'], ['Output jack and plate', 1, '', 'p'],
          ['Three-ply pickguard', 1, '', 'p'], ['Cloth push-back wire 22 AWG', 10, 'ft', 'p'], ['Copper shielding tape', 1, 'roll', 'c', 'solder'], ['60/40 rosin-core solder', 1, 'roll', 'c', 'solder']],
        steps: [['cover', null, 'Shielding the cavities with copper tape'], ['solder', 'iron', 'Wiring the pickups, switch, pots and jack on the pickguard']] },
      { key: 'setup', name: 'Strings and setup', weight: 0, stand: [0, 1.0],
        lines: [['Nickel strings 10–46', 1, 'set', 'p']],
        steps: [['fit', null, 'Stringing it up and tuning to pitch'], ['fit', 'screwdriver', 'Truss rod to 0.010 in. relief, action 4/64 in. at the 12th fret'], ['inspect', 'tuner', 'Setting the intonation at the 12th fret']] }
    ],
    tools: [
      ['bandsaw', 'Bandsaw', 'band ?saw', 'to cut the body and headstock'],
      ['router', 'Router with flush-trim bit', 'router', 'for the cavities and truss-rod slot'],
      ['sander', 'Random-orbit sander', 'sander', 'to sand the body'],
      ['clamps', 'Clamps (6)', 'clamps?', 'to glue the fingerboard'],
      ['fretHammer', 'Fret press or fret hammer', 'fret (press|hammer)', 'to seat the frets'],
      ['fretFile', 'Fret crowning file', 'fret file|crowning', 'to dress the frets'],
      ['drillPress', 'Drill press', 'drill press', 'for straight holes'],
      ['screwdriver', 'Screwdriver set', 'screwdriver', 'for the hardware'],
      ['iron', 'Soldering iron', 'soldering', 'for the wiring'],
      ['tuner', 'Strobe or clip-on tuner', '\\btuner\\b', 'to set the intonation']
    ],
    skills: ['Routing to a template', 'Fretwork', 'Lacquer finishing', 'Guitar wiring', 'Guitar setup'],
    tests: [['setup', 'Setup check', 'Relief 0.010 in., action 4/64 in., intonation within 2 cents'], ['sound', 'Plug-in test', 'Every pickup position sounds, no crackle or hum']]
  },

  kayak: {
    name: 'Wooden sea kayak', item: 'Wooden sea kayak', emoji: '🛶', site: 'beach', vehicle: 'boat',
    words: /\bkayaks?\b/i,
    wiki: ['Stitch and glue', 'Sea kayak'],
    summary: 'a 17 ft stitch-and-glue sea kayak: 4 mm okoume marine plywood panels stitched with copper wire, filleted and glassed with epoxy, a laminated cockpit coaming, two sealed hatches and bulkheads',
    subs: [
      { key: 'panels', name: 'Hull panels', weight: 18, stand: [0, 1.0],
        lines: [['4 mm okoume marine plywood 4 × 8 ft (BS1088)', 4, 'sheets', 'p'], ['Epoxy resin and hardener', 0.5, 'gal', 'c', 'glue'], ['Wood flour', 1, 'qt', 'c', 'glue']],
        steps: [['glue', null, 'Scarfing the plywood into 17 ft lengths'], ['cut', 'jigsaw', 'Cutting out the bottom and side panels from the plans']] },
      { key: 'stitch', name: 'Stitching', weight: 0, stand: [0, 1.0],
        lines: [['Copper stitching wire 18 AWG', 250, 'ft', 'p'], ['Wire stitches (twisted)', 400, '', 'f']],
        steps: [['drill', 'drill', 'Drilling stitch holes every 4 in.'], ['fit', 'pliers', 'Stitching the panels together with copper wire'], ['inspect', null, 'Sighting the hull for twist']] },
      { key: 'glass', name: 'Fillets and fibreglass', weight: 10, stand: [0, 1.0],
        lines: [['6 oz fibreglass cloth 50 in.', 15, 'yd', 'p'], ['Epoxy resin and hardener', 2.5, 'gal', 'c', 'cover'], ['Sandpaper 80–220 grit', 40, 'sheets', 'c', 'sand']],
        steps: [['glue', null, 'Tack-welding the seams with epoxy, then running fillets'], ['cover', 'squeegee', 'Glassing the hull inside and out'], ['sand', 'sander', 'Sanding the glass smooth']] },
      { key: 'deck', name: 'Deck and cockpit', weight: 9, stand: [0, 1.0],
        lines: [['3 mm okoume plywood 4 × 8 ft', 2, 'sheets', 'p'], ['Deck beams 3/4 × 1-1/2 in.', 4, '', 'p'], ['Laminated cockpit coaming rings', 3, '', 'p'], ['6 mm okoume bulkheads', 2, '', 'p']],
        steps: [['fit', 'clamps', 'Fitting the bulkheads and deck beams'], ['glue', 'clamps', 'Gluing down the deck'], ['fit', 'jigsaw', 'Cutting the cockpit and fitting the coaming']] },
      { key: 'outfit', name: 'Hatches and outfitting', weight: 5, stand: [0, 1.0],
        lines: [['Hatch lids with lips', 2, '', 'p'], ['Hatch straps', 4, '', 'p'], ['Bungee cord 1/4 in.', 30, 'ft', 'p'], ['Padeyes', 10, '', 'p'], ['Foam seat and backband', 1, 'set', 'p'],
          ['Adjustable foot braces', 1, 'pair', 'p'], ['Carry toggles', 2, '', 'p'], ['Stainless #8 screws', 40, '', 'f'], ['Spar varnish (UV)', 2, 'qt', 'c', 'paint']],
        steps: [['drill', 'drill', 'Fitting padeyes, deck lines and toggles'], ['fit', null, 'Fitting the seat, backband and foot braces'], ['paint', null, 'Three coats of varnish']] }
    ],
    tools: [
      ['jigsaw', 'Jigsaw', 'jig ?saw', 'to cut the panels'],
      ['drill', 'Cordless drill', 'drill(?! press)', 'for stitch holes'],
      ['pliers', 'Pliers and wire cutters', 'pliers|cutters', 'to twist the stitches'],
      ['squeegee', 'Epoxy squeegees and roller', 'squeegee|roller', 'to wet out the glass'],
      ['sander', 'Random-orbit sander', 'sander', 'to smooth the glass'],
      ['clamps', 'Clamps (12)', 'clamps?', 'for the deck and coaming']
    ],
    skills: ['Stitch-and-glue construction', 'Fibreglass and epoxy work', 'Fine woodworking'],
    tests: [['float', 'Float test', 'In the shallows: dry inside, sits level'], ['seat', 'Fit and roll check', 'Knees braced, easy exit']]
  },

  treefort: {
    name: 'Tree fort', item: 'Tree fort', emoji: '🏰', site: 'tree', vehicle: null, r: 2.2,
    words: /\btree ?(fort|house)s?\b|\bforts?\b|\bclubhouse\b/i,
    wiki: ['Tree house', 'Treehouse attachment bolt'],
    summary: 'an 8 × 8 ft fort 8 ft up in a big tree, hung on treehouse attachment bolts with knee braces, 2 × 8 beams and 2 × 6 joists, cedar decking, a railing, a metal roof and a ladder up through a trap door',
    subs: [
      { key: 'supports', name: 'Tree supports', weight: 0, stand: [1.8, 0],
        lines: [['Treehouse attachment bolts (TAB) 1-1/4 × 8 in.', 4, '', 'p'], ['Pressure-treated 4 × 4 knee braces, 8 ft', 4, '', 'p'], ['Galvanised lag screws 1/2 × 6 in.', 16, '', 'f']],
        steps: [['drill', 'auger', 'Boring 1-1/4 in. holes square into the trunk'], ['bolt', 'socket', 'Threading in the TABs'], ['bolt', 'socket', 'Lagging on the knee braces']] },
      { key: 'platform', name: 'Beams and joists', weight: 0, stand: [1.8, 0],
        lines: [['Pressure-treated 2 × 8 beams, 10 ft', 4, '', 'p'], ['Pressure-treated 2 × 6 joists, 8 ft', 7, '', 'p'], ['Joist hangers 2 × 6', 14, '', 'p'],
          ['Joist-hanger nails', 140, '', 'f'], ['Carriage bolts 1/2 × 6 in. with nuts and washers', 12, '', 'f']],
        steps: [['cut', 'circSaw', 'Cutting the beams and joists'], ['bolt', 'socket', 'Hanging the beams on the TABs'], ['fit', 'hammer', 'Hanging the joists 16 in. on centre'], ['inspect', 'level', 'Checking level and square']] },
      { key: 'deck', name: 'Decking', weight: 0, stand: [1.8, 0],
        lines: [['5/4 × 6 cedar decking, 8 ft', 20, '', 'p'], ['Deck screws 2-1/2 in.', 400, '', 'f']],
        steps: [['cut', 'circSaw', 'Notching boards around the trunk with 2 in. to grow'], ['fit', 'driver', 'Screwing down the decking']] },
      { key: 'walls', name: 'Walls and railing', weight: 0, stand: [1.8, 0],
        lines: [['2 × 4 posts and rails, 8 ft', 24, '', 'p'], ['Cedar fence boards 1 × 6 × 6 ft', 40, '', 'p'], ['Deck screws 2 in.', 300, '', 'f']],
        steps: [['cut', 'circSaw', 'Cutting posts and rails'], ['fit', 'driver', 'Screwing on the railing and wall boards'], ['inspect', null, 'Pushing hard on the railing']] },
      { key: 'roof', name: 'Roof', weight: 0, stand: [1.8, 0],
        lines: [['2 × 4 rafters, 8 ft', 10, '', 'p'], ['Corrugated metal roofing 26 in. × 8 ft', 5, '', 'p'], ['Roofing screws with neoprene washers', 150, '', 'f']],
        steps: [['fit', 'driver', 'Framing the roof'], ['cover', 'driver', 'Screwing down the metal roofing']] },
      { key: 'access', name: 'Ladder and trap door', weight: 0, stand: [1.8, 0],
        lines: [['Pressure-treated 2 × 6 ladder rails, 12 ft', 2, '', 'p'], ['2 × 4 rungs', 10, '', 'p'], ['Trap-door hinges', 2, '', 'p'], ['Structural screws 3 in.', 40, '', 'f']],
        steps: [['cut', 'circSaw', 'Cutting the rails and rungs'], ['fit', 'driver', 'Building the ladder and trap door'], ['inspect', null, 'Climbing up and down three times']] }
    ],
    tools: [
      ['circSaw', 'Circular saw', 'circular saw|\\bsaw\\b', 'to cut lumber'],
      ['driver', 'Impact driver', 'impact driver|drill', 'for the screws'],
      ['auger', 'Drill with a 1-1/4 in. auger bit', 'auger', 'to bore for the TABs'],
      ['socket', 'Socket wrench with 3/4 in. socket', 'socket|wrench', 'to drive the TABs and bolts'],
      ['hammer', 'Framing hammer', '^(?!.*jack ?hammer).*hammer', 'for the joist hangers'],
      ['level', '4 ft level', '\\blevel\\b', 'to level the platform'],
      ['harness', 'Fall-arrest harness and rope', 'harness', 'to work safely up the tree']
    ],
    skills: ['Working at height safely', 'Framing', 'Building around a living tree'],
    tests: [['load', 'Load test', 'Four 75 lb sandbags on the deck overnight: no movement'], ['rail', 'Railing push test', 'A hard push on every rail section']]
  }
};

function bomTemplateFor(target) {
      const t = String(target || '');
      return Object.keys(BOM_TEMPLATES).find(k => BOM_TEMPLATES[k].words.test(t)) || null;
    }

function bomFmtQty(q) {
      const n = Number(q) || 0;
      return Number.isInteger(n) ? n.toLocaleString('en-US') : String(Math.round(n * 100) / 100);
    }

// "AN3-5A bolts × 48", "4130 chromoly tube 3/4 in. × 0.035 in. × 20 ft"
function bomLineLabel(line) {
      return `${line.name} × ${bomFmtQty(line.qty)}${line.unit ? ' ' + line.unit : ''}`;
    }

// Which step uses a line up: its own step verb if it has one; fasteners by what they are; parts are
// fitted across the whole sub-assembly (no step); consumables by what they do
function bomLineStep(sub, line) {
      const verbs = sub.steps.map(s => s.verb);
      const find = (...vs) => { for (const v of vs) { const i = verbs.indexOf(v); if (i >= 0) return i; } return -1; };
      if (line.step) { const i = find(line.step); if (i >= 0) return i; }
      const n = line.name;
      if (line.kind === 'f') {
        if (/rivet/i.test(n)) return find('rivet', 'fit', 'bolt');
        if (/staple|nail/i.test(n)) return find('glue', 'fit', 'cover', 'bolt');
        if (/screw/i.test(n)) return find('fit', 'bolt', 'cover', 'drill');
        if (/sleeve|thimble/i.test(n)) return find('swage', 'fit');
        if (/stitch/i.test(n)) return find('fit');
        if (/terminal|tie/i.test(n)) return find('wire', 'solder', 'fit');
        return find('bolt', 'fit', 'rivet');
      }
      if (line.kind === 'c') {
        if (/filler|argon|mig wire|welding|shielding/i.test(n)) return find('weld');
        if (/solder|flux|shielding tape|heat-shrink/i.test(n)) return find('solder', 'wire');
        if (/glue|cement|titebond|wood flour/i.test(n)) return find('glue', 'cover');
        if (/epoxy|resin/i.test(n)) return find('cover', 'glue');
        if (/sandpaper|grit|disc/i.test(n)) return find('sand', 'cut', 'notch');
        if (/fuel|gasoline|petrol|avgas/i.test(n)) return find('fuel');
        if (/paint|primer|lacquer|varnish|poly-|topcoat|enamel|oil|reducer|sealer/i.test(n)) return find('paint', 'cover');
      }
      return -1;
    }

// A built-in plan turned into a fresh bill of materials to track
function bomFromTemplate(key) {
      const t = BOM_TEMPLATES[key];
      if (!t) return null;
      return normalizeBom({
        templateKey: key, name: t.name, item: t.item, emoji: t.emoji, site: t.site, vehicle: t.vehicle, itemKind: t.itemKind || null, r: t.r || null, summary: t.summary, wiki: t.wiki,
        subs: t.subs.map(s => ({ key: s.key, name: s.name, weight: s.weight || 0, arm: s.arm || 0, stand: s.stand || null,
          lines: s.lines.map(([name, qty, unit, kind, step]) => ({ name, qty, unit, kind, step })),
          steps: s.steps.map(([verb, tool, say]) => ({ verb, tool, say })) })),
        tools: t.tools.map(([key, name, re, why]) => ({ key, name, re, why })),
        skills: t.skills.slice(), tests: t.tests.map(([key, name, how]) => ({ key, name, how })), cg: t.cg || null
      });
    }

function bomClip(v, n = BOM_LIMITS.name) {
      return String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
    }

function bomKey(text, used) {
      let k = String(text || 'part').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14) || 'part';
      while (used.has(k)) k += 'x';
      used.add(k);
      return k;
    }

// A tool's name turned into a loose pattern for "does he own one?" (the first two real words)
function bomToolPattern(name) {
      const words = String(name || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/^(an?|the)\s+/, '').match(/[a-z][a-z0-9-]+/g) || ['tool'];
      return words.slice(0, 2).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(' ');
    }

// Checks and caps any BOM (built-in or written by the AI) and gives every line its tracking fields
function normalizeBom(b) {
      if (!b || typeof b !== 'object') return null;
      const L = BOM_LIMITS;
      const toolKeys = new Set();
      const tools = (Array.isArray(b.tools) ? b.tools : []).slice(0, L.tools).map(t => {
        const name = bomClip(typeof t === 'string' ? t : t && t.name);
        if (!name) return null;
        let re = typeof t === 'object' && t.re ? String(t.re) : bomToolPattern(name);
        try { new RegExp(re, 'i'); } catch (e) { re = bomToolPattern(name); }
        return { key: bomKey((typeof t === 'object' && t.key) || name, toolKeys), name, re, why: bomClip(t && t.why, 120), sent: 0 };
      }).filter(Boolean);
      const toolByName = n => {
        if (!n) return null;
        const s = String(n).toLowerCase();
        const hit = tools.find(t => t.key.toLowerCase() === s || t.name.toLowerCase() === s) || tools.find(t => s.includes(t.name.toLowerCase().split(' ')[0]) || t.name.toLowerCase().includes(s));
        return hit ? hit.key : null;
      };
      const subKeys = new Set();
      const subs = (Array.isArray(b.subs) ? b.subs : []).slice(0, L.subs).map(s => {
        if (!s || typeof s !== 'object') return null;
        const name = bomClip(s.name, 48);
        if (!name) return null;
        const key = bomKey(s.key || name, subKeys);
        const lines = (Array.isArray(s.lines) ? s.lines : []).slice(0, L.lines).map((l, i) => {
          const qty = Math.round(Math.min(L.qty, Math.max(0.01, Number(l && l.qty) || 0)) * 100) / 100;
          const lname = bomClip(l && l.name);
          if (!lname || !qty) return null;
          const kind = ['p', 'f', 'c'].includes(l.kind) ? l.kind : /^fast/i.test(l.kind) ? 'f' : /^cons/i.test(l.kind) ? 'c' : 'p';
          return { id: `${key}-${i}`, name: lname, qty, unit: bomClip(l.unit, 12), kind, step: BOM_STEP_VERBS.includes(l.step) ? l.step : null, got: 0, sent: 0, used: 0 };
        }).filter(Boolean);
        const steps = (Array.isArray(s.steps) ? s.steps : []).slice(0, L.steps).map(st => {
          if (!st) return null;
          const verb = BOM_STEP_VERBS.includes(st.verb) ? st.verb : 'fit';
          const tool = st.tool && tools.some(t => t.key === st.tool) ? st.tool : toolByName(st.tool);
          return { verb, tool: tool || null, say: bomClip(st.say, 120) || `${verb[0].toUpperCase()}${verb.slice(1)}ing` };
        }).filter(Boolean);
        if (!lines.length) return null;
        if (!steps.length) steps.push({ verb: 'fit', tool: null, say: `Putting the ${name.toLowerCase()} together` }, { verb: 'inspect', tool: null, say: 'Checking it over' });
        const sub = { key, name, weight: Math.max(0, Math.min(5000, Number(s.weight) || 0)), arm: Math.max(-400, Math.min(400, Number(s.arm) || 0)),
          stand: Array.isArray(s.stand) ? s.stand.slice(0, 2).map(Number) : null, lines, steps, stepsDone: 0, built: false };
        // Remember which step each line belongs to, so consumption is the same every time
        lines.forEach(l => { l.stepAt = bomLineStep(sub, l); });
        return sub;
      }).filter(Boolean);
      if (!subs.length) return null;
      return {
        templateKey: BOM_TEMPLATES[b.templateKey] ? b.templateKey : null,
        name: bomClip(b.name, 48) || 'Something new', item: bomClip(b.item || b.name, 60), emoji: bomClip(b.emoji, 4) || '🛠️',
        site: ['airfield', 'bench', 'beach', 'spot', 'tree'].includes(b.site) ? b.site : 'airfield',
        vehicle: ['plane', 'kart', 'boat'].includes(b.vehicle) ? b.vehicle : null, itemKind: ['tool', 'toy', 'thing'].includes(b.itemKind) ? b.itemKind : null,
        r: Number(b.r) || null, summary: bomClip(b.summary, 400), wiki: (Array.isArray(b.wiki) ? b.wiki : []).slice(0, 3).map(w => bomClip(w, 60)),
        subs, tools, skills: (Array.isArray(b.skills) ? b.skills : []).slice(0, L.skills).map(s => bomClip(s, 60)).filter(Boolean),
        tests: (Array.isArray(b.tests) ? b.tests : []).slice(0, L.tests).map((t, i) => ({ key: bomClip(t && t.key, 12) || 'test' + i, name: bomClip(t && t.name, 48) || 'Final check', how: bomClip(t && t.how, 160) })),
        cg: b.cg || null
      };
    }

// With an AI key: the AI writes the bill of materials as strict JSON, which is checked and capped
async function bomFromAI(target, why = '', readings = []) {
      if (typeof hasLLMKey !== 'function' || !hasLLMKey() || typeof callLLMJSON !== 'function') return null;
      const prompt = `You are Kelo-1, a careful robot builder. You are going to build a real ${target} from scratch${why ? ` (${why})` : ''}.
${readings.length ? `What you read at NetNode: ${readings.map(r => `${r.title}: ${r.extract.slice(0, 300)}`).join(' | ')}\n` : ''}Write a realistic, detailed bill of materials, accurate down to the screw: real materials and grades, sizes and specs (e.g. "4130 chromoly tube 3/4 in. × 0.035 in.", "AN3-5A bolts", "1/8 in. aluminium pop rivets"), exact quantities, every fastener, and the consumables that get used up.
Return ONLY JSON:
{"name": "short name", "summary": "1 sentence: the design you chose and its key dimensions",
 "vehicle": "plane" | "kart" | "boat" | null (only if you can ride, drive, paddle or fly it),
 "subAssemblies": [4 to 10 of {"name": "...", "weightLb": number, "parts": [4 to 25 of {"name": "...", "qty": number, "unit": "" or "ft" or "yd" or "gal" or "lb" or "sheets"..., "kind": "part" | "fastener" | "consumable"}],
   "steps": [2 to 6 of {"verb": one of ${JSON.stringify(BOM_STEP_VERBS)}, "tool": "a tool name from your tools list or null", "say": "what you do, 4-12 words"}]}],
 "tools": [4 to 20 of {"name": "...", "why": "..."}],
 "skills": ["skills it takes"],
 "tests": [1 to 3 of {"name": "a real inspection or test", "how": "..."}]}`;
      let parsed = null;
      try { parsed = await callLLMJSON([{ text: prompt }]); } catch (e) { parsed = null; }
      if (!parsed || !Array.isArray(parsed.subAssemblies)) return null;
      const kindOf = k => /fast/i.test(k) ? 'f' : /cons/i.test(k) ? 'c' : 'p';
      const bom = normalizeBom({
        templateKey: null, name: parsed.name || target, item: `Home-built ${String(parsed.name || target).toLowerCase()}`, emoji: '🛠️',
        site: parsed.vehicle === 'boat' ? 'beach' : 'airfield', vehicle: parsed.vehicle, summary: parsed.summary,
        subs: parsed.subAssemblies.map(s => ({ name: s && s.name, weight: s && s.weightLb,
          lines: (s && Array.isArray(s.parts) ? s.parts : []).map(p => ({ name: p && p.name, qty: p && p.qty, unit: p && p.unit, kind: kindOf(p && p.kind) })),
          steps: (s && Array.isArray(s.steps) ? s.steps : []).map(st => ({ verb: st && String(st.verb || '').toLowerCase(), tool: st && st.tool, say: st && st.say })) })),
        tools: (Array.isArray(parsed.tools) ? parsed.tools : []).map(t => ({ name: t && (t.name || t), why: t && t.why })),
        skills: parsed.skills, tests: (Array.isArray(parsed.tests) ? parsed.tests : []).map(t => ({ name: t && t.name, how: t && t.how }))
      });
      // A plan with too little in it isn't a real bill of materials
      if (!bom || bom.subs.length < 2 || bom.subs.reduce((n, s) => n + s.lines.length, 0) < 8) return null;
      // A known kind of thing still gets its proper 3D model
      bom.templateKey = bomTemplateFor(target) || bomTemplateFor(bom.name);
      if (bom.templateKey) { const t = BOM_TEMPLATES[bom.templateKey]; Object.assign(bom, { site: t.site, vehicle: t.vehicle, itemKind: t.itemKind || null, r: t.r || null, emoji: t.emoji, cg: t.cg || null }); }
      return bom;
    }

// --- Counting --------------------------------------------------------------------------------------
function bomFastenerCount(sub) {
      return sub.lines.filter(l => l.kind === 'f').reduce((n, l) => n + l.qty, 0);
    }

function bomFastenersLeft(sub) {
      return sub.lines.filter(l => l.kind === 'f').reduce((n, l) => n + Math.max(0, l.qty - (l.used || 0)), 0);
    }

function bomSubReceived(sub) {
      return sub.lines.filter(l => l.got >= l.qty).length;
    }

function bomSubComplete(sub) {
      return sub.lines.every(l => l.got >= l.qty);
    }

function bomLineCount(bom) {
      return bom.subs.reduce((n, s) => n + s.lines.length, 0);
    }

function bomPercentBuilt(bom) {
      if (!bom.subs.length) return 0;
      return Math.round(bom.subs.reduce((n, s) => n + (s.built ? 1 : s.stepsDone / Math.max(1, s.steps.length)), 0) / bom.subs.length * 100);
    }

function bomPercentReceived(bom) {
      const total = bomLineCount(bom);
      return total ? Math.round(bom.subs.reduce((n, s) => n + bomSubReceived(s), 0) / total * 100) : 0;
    }

// --- Lists to paste into a shopping list -------------------------------------------------------------
// One sub-assembly (or the tools list when subKey is '__tools')
function bomListLines(bom, subKey) {
      if (subKey === '__tools') return bom.tools.map(t => ({ id: 'tool-' + t.key, name: t.name, qty: 1, unit: '', kind: 'tool', got: typeof bomToolOwned === 'function' && bomToolOwned(t) ? 1 : 0, sent: t.sent || 0, why: t.why }));
      const sub = bom.subs.find(s => s.key === subKey);
      return sub ? sub.lines : [];
    }

function bomListTitle(bom, subKey) {
      if (subKey === '__tools') return `${bom.name}: tools`;
      const sub = bom.subs.find(s => s.key === subKey);
      return `${bom.name}: ${sub ? sub.name : subKey}`;
    }

function bomListText(bom, subKey) {
      const lines = bomListLines(bom, subKey);
      const sub = bom.subs.find(s => s.key === subKey);
      const out = [`${bomListTitle(bom, subKey)} (parts list from Kelo-1)`, ...lines.map(l => `[${l.got >= l.qty ? 'x' : ' '}] ${bomLineLabel(l)}${l.make ? ` (I'll make this on the ${l.makeOn || l.make})` : l.forShop ? ' (supplies for my shop)' : ''}`)];
      if (sub) out.push(`Fasteners in this sub-assembly: ${bomFmtQty(bomFastenerCount(sub))}`);
      return out.join('\n');
    }

function bomListMarkdown(bom, subKey) {
      const lines = bomListLines(bom, subKey);
      const sub = bom.subs.find(s => s.key === subKey);
      const kindName = { p: 'part', f: 'fastener', c: 'consumable', tool: 'tool' };
      return [`### ${bomListTitle(bom, subKey)}`, '', '| Got | Item | Qty | Unit | Kind |', '|:-:|---|--:|---|---|',
        ...lines.map(l => `| ${l.got >= l.qty ? '[x]' : '[ ]'} | ${l.name.replace(/\|/g, '/')}${l.make ? ` (I'll make this on the ${l.makeOn || l.make})` : ''} | ${bomFmtQty(l.qty)} | ${l.unit || 'pcs'} | ${l.make ? 'shop-made' : kindName[l.kind] || 'part'} |`),
        ...(sub ? ['', `**Fasteners:** ${bomFmtQty(bomFastenerCount(sub))}`] : [])].join('\n');
    }
