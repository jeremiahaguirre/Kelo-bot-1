# Kelo-1's long goals (js/goals.js)

Long goals sit above the agenda (`js/agenda.js`). A goal is **goal → stages → tasks**. Each task names an
**action** that runs one of his real activities. Each goal is one agenda task (`kind: 'goal'`), so the
agenda's focus, pause-for-sleep-or-a-visitor and resume-after-reload apply to it. Both brains use goals:
without a key the agenda runs their steps in his free moments. With a key the AI sees them in the
decision prompt, and it can take up one of the offered ideas with `"newGoal": "<template id>"`.

He picks goals himself. Each template's `keywords` are matched against three sources: his interests
(hobbies, concepts, likes, skills), what visitors said and asked, and what he read at NetNode. The score is
then weighted by how similar goals went before (`js/outcomes.js`). The source is recorded and shows in
his diary ("A visitor got me thinking…").

Saved in `state.goals` (`list`: at most 2 open; `history`: the last 12 finished or dropped). Old saves
without it start empty.

## Adding a kind of goal (for the farm machine and others)

```js
// A step type a template can use. run() returns like any activity: true/undefined = done,
// a reason string ('needs-tools', 'learning', ...) = blocked, false = didn't start.
registerGoalAction('till', {
  key: t => 'farm',                              // activity key for the loop guard and outcome learning
  label: t => `till the ${t.field} field`,       // shown in the Brain tab and the diary
  blocker: (t, goal) => null,                    // optional: { type, label, ... } to wait first (see below)
  done: (t, goal) => false,                      // optional: true if the step's purpose is already met
  run: (t, goal) => tillField(t.field)           // the real activity
});

registerGoalTemplate('big-farm', {
  title: p => 'Build a big farm',                // string or (params) => string
  emoji: '🚜',
  base: 0.5,                                     // appeal with no matching signals (0..2)
  keywords: /\b(farm\w*|fields?|crops?|tractor|barn|harvest\w*)\b/i,
  params: ({ signals }) => ({ fields: 3 }),      // null = not possible right now
  why: (p, source) => 'I want to grow food for the whole valley',
  repeatAfterDays: 5,                            // don't pick it again too soon
  stages: p => [
    { name: 'Plan it', tasks: [{ do: 'research', topic: 'how to lay out a farm' }] },
    { name: 'Get the tools', tasks: [{ do: 'ask', items: ['A tractor', 'A plough'], category: 'vehicle' }] },
    { name: 'Till the fields', tasks: [{ do: 'till', field: 'north' }, { do: 'till', field: 'east', newDay: true }] },
    { name: 'Look back', tasks: [{ do: 'reflect' }] }
  ]
});

goalStart('big-farm', { source: 'visitor' });    // or let him pick it himself
```

A task may set `newDay: true` (it waits for the next game day after the goal's last step, so a goal spreads
over several days). It may also set `optional`.

### Built-in actions
`research {topic}`, `ask {items, category, why}`, `mail`, `practise {match}`, `paint {medium, subject}`,
`stargaze`, `hobby {name}`, `project {key}` + `projectDone {key}`, `plant`, `tend`, `visit {spot}`,
`print`, `reflect {concept?}`, `waitfor {cond: 'calm'|'time', until}`.

### Blockers (`{ type, label, … }`)
`night`, `day`, `nextDay {day}`, `season {seasons: [...]}`, `items {items: [regex source]}` (owned),
`skill {skill, level}`, `calm`, `ready {action, task}` (the action's own blocker clears), `time {until}`.
A goal blocked for more than 1.5 game days (season waits excepted) is dropped, and the diary says why.

## Learning from results (js/outcomes.js)
Every activity he tries leaves a record: whether it worked, why not, how long it took, what it used up and
his mood after. That record is used in five ways:
- An activity that keeps failing comes up less often. One that works and that he enjoys comes up more.
- Activities he has rarely tried get a little pull, so he keeps exploring.
- He learns *when* things work (night or day, the season, tired or rested, windy or calm). He writes it
  down ("I've noticed a pattern: stargazing tends to go wrong in the wind").
- The same failing plan isn't retried while nothing has changed.
- A goal step that failed is retried differently: the fix becomes a step first. He remembers which fix
  worked for each kind of failure and picks that one next time.

Recent results count more than old ones, so he changes his mind when his world changes. Everything is
bounded in the save: 60 records, 40 activities and 20 lessons.
