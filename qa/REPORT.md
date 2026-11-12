# Agenda, focus and roadworks: report (branch `agent/agenda`)

## Commits on agent/agenda
- 9af080a Agenda: one persistent open-task list with focus, pause/resume, waits and reload recovery
- 8507386 Roadworks: research, a parts list and the real crew steps for roads, plus a dormant runway job
- 44a2ad0 Runway job sets RUNWAY_FIELD.stage as each step finishes
- e920de6 Agenda: keep 16 history entries per task
- cb02000 Roadworks: parts list for gear without know-how text; a broken agenda step waits instead of retrying every tick
- ce5cdc1 Roadworks: fetching a tool from the Storehouse never stalls a step

## What he was forgetting, and why
- **Road jobs**: after asking for a shovel, wheelbarrow or compactor nothing brought him back when they arrived; he only returned by random chance.
- **Reloads**: a road, paving or plant job in progress was lost (the road was only saved when finished). The "do it when free" queue lived in memory (lost on reload) and dropped jobs after 45 minutes.
- **Visitor Workshop asks** were held in memory only (still the case; noted below).
- **Paintings**: a planned painting silently vanished after two days without supplies, with no diary line.
- **Requests**: past 12 requests the oldest *open* ones were deleted.
- **Focus**: each free moment picked an activity by chance, so after one step of a big build he drifted to something else.

## How the agenda and focus work (js/agenda.js, js/agendalinks.js)
- `state.agenda.tasks`: id, kind, title, why, steps and the current step, status open/active/waiting/paused/done/abandoned, what it waits for (delivery, supply, skill, plant, weather, season, owner, time), priority, history.
- **Focus first**: every free life tick runs the next step of the committed task before any whim; at most 2 tasks in progress at once.
- **Interruptions**: eating, drinking, sleep, a visitor's letter or chat pause the task; he resumes at the same step afterwards.
- **Waiting**: re-checked every 6 s; when what he waits for reaches the Post Office he goes for the mail and picks the task back up.
- **Reload**: a running task becomes "paused (reload)" and continues at its step.
- **Dropping**: only on purpose, with a diary line saying why (the AI can drop a task only with a reason).
- **Diary**: a line each time he takes on, pauses, resumes, waits on, picks back up, finishes or drops a task.
- **Both brains**: the AI prompt gets a short open-tasks line plus a resume/drop field; the no-key brain uses the same list.
- **Brain tab**: read-only "Open tasks" section with status, current step, what it waits on, and step chips.
- **Old saves**: tasks are built once from projects, big builds, planned paintings, Workshop orders and open requests. Open requests a task waits on are never trimmed.
- **Covered kinds**: projects, big builds (bill of materials), paintings, Workshop orders, deliveries, roads, runway.

## Roads and the runway (js/roadworks.js)
1. Research at NetNode.
2. One parts-list card in the Post tab (send all / send some / copy / not now), with quantities worked out from the road's real size.
3. Survey and stake (survey kit, stakes, marking paint).
4. Clear and grub (crawler bulldozer).
5. Rough grade (motor grader).
6. Ditches with the excavator, a culvert, and concrete headwalls poured from his own batch plant in the mixer truck.
7. Compact the subgrade (single-drum soil compactor).
8. Crushed base hauled from his stockpile in the dump truck and spread by the grader.
9. Compact the base.
10. Prime coat (asphalt distributor, emulsion).
11. Pave: hot mix from his own asphalt plant, hauled by the dump truck, laid by the paver, breakdown-rolled by the tandem roller.
12. Finish rolling.
13. Cure (world time).
14. Line marking (line striper, yellow traffic paint, glass beads).

Every step waits for its own machines, materials, diesel, plant output and dry, non-winter weather.

- **New machines**: bulldozer, motor grader, soil compactor, tandem roller and asphalt paver, all full-size models parked on the plant's yard. Each has know-how, burns diesel and earns skills.
- **New tools**: survey kit, asphalt distributor and line striper.
- **Materials**: a ledger that every step uses up.
- **Runway**:
  - Idle until `RUNWAY_FIELD` exists (it comes from agent/runway).
  - Researches, sends a list that adds edge lights, threshold lights, designation signs, a windsock and white paint, then works the strip in 8 sections.
  - Paints aviation markings (threshold bars, runway numbers from the heading, centre line, aiming points, edge lines) and installs the lights.
  - Sets `runwayJobActive` while working, moves `RUNWAY_FIELD.stage` along and sets `developed` at the end.
- **Simplification (runway only)**: per section one real plant batch and one truck haul are shown; the rest of the section's base and asphalt comes off bulk deliveries from the parts list, not extra plant runs.

## Tests (qa/agendatest.js; run one at a time)
- `agenda`: all checks pass, no page errors. Eating, sleep, a visitor and a reload each paused the birdhouse and he resumed at the same step; he picked up the nails at the Post Office, built it, and every diary line is there. (An earlier run failed 2 checks on snapshot timing; they now read the task history.)
- `roadwork` (about 100 min on this machine):
  - Every step ran in order from research to line marking, with the right equipment from the list.
  - The meal paused grading and he resumed it; the reload during subgrade kept the step.
  - Materials were used up and there were no page errors.
  - The run reached its time limit during line marking.
- `roadfinish`: the last step on its own; all checks pass, no page errors.
- `runway`:
  - Idle without the field. With a stub field he researched first and sent a list with lights, signs, windsock, paint and machines.
  - Nothing on the field was touched before the gear arrived; he then surveyed and staked the strip.
  - All checks pass, no page errors.
- Regressions: every test below exits 0 with "page errors: none".

| test | exit | page errors |
|---|---|---|
| reload | 0 | none |
| chat | 0 | none |
| ui | 0 | none |
| skills | 0 | none |
| haul | 0 | none |
| landfill | 0 | none |
| planitems | 0 | none |
| printshop | 0 | none |
| gear | 0 | none |

Screenshots (`qa/shots`, device scale 2): `agenda-open-tasks.png` (Brain tab Open tasks), `agenda-partslist.png` (the parts-list card), `agenda-road-paving.png` (road job mid-way with the paver and roller), `agenda-runway-staked.png` (runway after survey).

## Left / known
- Visitor Workshop asks (`workshopAsks`) are still in memory only.
- Big runway quantities come off the bulk ledger (see above).
- No new action pose: road machines use the existing driving seat; walking tools use the 'normal'/'digging' poses (a pushing pose could be added by the animation work).
- The full road test takes about 100 minutes on this slow machine.
