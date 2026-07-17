# ACKS II — Influence & Reactions

A small Foundry VTT **module** that augments the [ACKS II](https://autarch.games/)
game system (`acks`) with a reaction/influence roller for the three ACKS II
influence tones: **Diplomacy**, **Intimidation**, and **Seduction**.

It does **not** modify the ACKS system — it hooks into the character sheet and
chat, and reads actor data through public paths only.

## Features

- **Tone-aware 2d6 roller.** Pick a tone and the form swaps to that tone's
  exhaustive modifier set (every modifier from the player rules and GM screen).
- **Attitude tracker.** Portraits of the influencer and target flank a clickable
  5-rung attitude ladder (Hostile → Friendly, relabeled Intimidated/Overawed for
  intimidation). The current attitude supplies the relationship modifier.
- **Attempt levels.** A single *Attempt* selector drives everything: level 0 is
  the **initial reaction** (instant — the 2d6 result sets the attitude directly);
  levels 1–5 are **attempts to influence** (each shifts the current attitude 1–2
  rungs and carries a **time cost**). After any roll the tracker advances and the
  attempt steps forward, so the initial reaction rolls naturally into the 1st
  attempt.
- **Auto-population with overrides.** Charisma, target Will, alignment match, the
  **level/HD gap** (class level for characters, HD for monsters — ±1 at a 3+
  difference), and the relevant proficiencies (Diplomacy, Intimidate, Seduction,
  Mystic Aura, Performance/Art) are detected from the character and the
  currently-targeted token. Every value is editable, and a **Reset to defaults**
  button re-detects them. Auto fields are badged ✨; a value driven by a
  proficiency (e.g. the bribe fee under Bribery) is badged 🖐; overrides are
  highlighted.
- **Effect-driven modifiers (extensible).** Only the four core proficiencies
  (Diplomacy, Intimidation, Seduction, Mystic Aura) are hardcoded. Every other
  reaction bonus — Beast Friendship, Animal Husbandry, Folkways, and any custom
  proficiency or class power — is contributed by an **Active Effect** on the
  item, so new content works without touching the module. See
  [Reaction-granting effects](#reaction-granting-effects).
- **GM adjustment / overridable total.** A generic catch-all bucket for anything
  not modeled (Bargaining, Command, ad-hoc rulings). The **Final Modifier** cell
  is itself editable — type over it and the difference is banked as a GM
  adjustment.
- **Rich chat card.** Shows the roll, the **list of active modifiers**, the
  starting → ending attitude, the attitude shift and time cost, and a **Mystic
  Aura "bewitched"** note when a total of 12+ triggers the kicker.
- **Screen-faithful layout.** Modifiers are laid out row-for-row in the order of
  the Judges Journal GM screen, grouped by Both / Either / Character / Target.
- **Drag to set the parties.** Drag any actor or token onto the left portrait to
  set the influencer, or the right portrait to set the target; auto-populated
  values (CHA, Will, alignment, proficiencies) refresh to the new actors.
- **Bribes move gold.** The bribe row has a fee (gp) that auto-populates from the
  target's HD via the Henchman Monthly Wage table — scaled by the bribe bonus and
  Bribery proficiency — overridable and resettable. On a roll with a bribe, the
  fee is transferred from the influencer's Gold to the target.
- **Stored attitudes.** Influencing a target auto-saves a relationship as an
  `acks-influence.attitude` Item on the character (current attitude + attempts
  used **per tone**), and the roller auto-loads it next time. A **Relationships**
  strip on the character sheet lists them (click to open, drag to another actor to
  transfer a contact). Non-GM players hide target details and get a GM-whispered
  roll + a public attitude-only reveal.
- **Launch points:** an Influence button in the character-sheet header, the
  `/influence` (or `/inf`) chat command, a **macro** in the module's *Influence
  Macros* compendium, and a module API:
  `game.modules.get("acks-influence").api.open(actor)`.

## Installation

### From GitHub (manifest URL)

In Foundry: **Add-on Modules → Install Module**, and paste this manifest URL:

```
https://github.com/NocTempre/acks-influence/releases/latest/download/module.json
```

This resolves to the assets of the newest GitHub **release**, so a release must
exist first (see below). Foundry uses the same URL to detect and install updates.

### Cutting a release

Releases are produced automatically by [`.github/workflows/release.yml`](.github/workflows/release.yml)
when you push a version tag whose number matches `module.json`:

```
git tag v1.0.0
git push origin v1.0.0
```

The workflow rebuilds the compendium, packages `module.zip` (module code +
templates + styles + lang + the compiled pack + docs, excluding dev tooling),
and attaches `module.json` and `module.zip` to the release.

### Local development

Copy or symlink this folder into your Foundry data `Data/modules/` directory as
`acks-influence`, then enable it in a world running the ACKS system.

```
# from your Foundry userdata dir
ln -s C:/Proj/acks-influence Data/modules/acks-influence   # (or copy the folder)
```

## Test compendium

The module ships an **Influence Proficiencies (Test)** Item compendium
(`packs/proficiencies`) containing the reaction-relevant proficiencies as ACKS
`ability` items — Diplomacy, Intimidate, Seduction, Mystic Aura, Beast
Friendship, Animal Husbandry, Folkways, Performance, Bargaining, Bribery. Drag any
onto a character to verify auto-detection and the situational toggles wire up
correctly. Names match the ACKS system items, so detection behaves identically
with the system's own compendium.

The module also ships an **Influence Macros** compendium with an *Influence
Roller* macro that opens the tool for the selected token (or your assigned
character) from anywhere — drag it to your hotbar.

To regenerate the packs after editing `tools/build-packs.mjs`:

```
npm install      # dev-only: pulls classic-level
npm run build:packs
```

The compiled LevelDB under `packs/proficiencies/` is committed and shipped;
`node_modules/` and `package.json` are dev-only and not loaded by Foundry.

## Reaction-granting effects

Any proficiency, class power, item, or actor can feed the influence roller with a
**passive Active Effect**. Add an effect with a single change:

| Field | Value |
|---|---|
| Attribute Key | `flags.acks-influence.reaction` |
| Change Mode | Add |
| Effect Value | the modifier, e.g. `2` or `-1` |

Then, on the effect's flags (`flags.acks-influence`), you may set:

- `situational` (boolean, default `true`) — `true` shows it as an unticked
  checkbox the GM enables when it applies (e.g. Beast Friendship, only vs
  animals); `false` applies it automatically (e.g. an always-on class power).
- `tone` — restrict the bonus to a context. One of `all`, `diplomacy`,
  `intimidation`, `seduction`, or a comma-separated list (e.g.
  `diplomacy,intimidation`). Default `all`. The bonus is only offered — and only
  appears in the roller — for its matching tone(s).
- `label` (string, optional) — display label; defaults to the effect's name.
- `bewitched` (boolean) — if the roll's **total reaches 12+** while this effect is
  active, the chat card notes the subject is **bewitched/charmed** (like Mystic
  Aura). E.g. Command of Voice, Glamorous Aura.
- `alignmentSign` (`law` | `chaos` | `neutral`) — the bonus is **+value when the
  target's alignment matches**, **−value otherwise**. E.g. Deathly Visage (+2 vs
  Chaotic, −2 vs non-Chaotic).
- `alignmentOnly` (`law` | `chaos` | `neutral`) — a **gate**, not a sign flip:
  the modifier only pre-checks when the target's alignment matches (e.g.
  Ancient Pacts, +1 vs *Chaotic* monsters — no penalty vs others).
- `vs` (string) — **target-kind scoping**: a comma-separated list of race/kind
  tokens (e.g. `animal`, `dwarf`, `human,demi-human`, `beastman`, `monster`,
  `goblin`). The modifier pre-checks when the current target matches a token
  (from the roller's auto-detected, overridable **Target kind** field), stays
  unchecked when the typing is known and doesn't match, and falls back to a
  plain situational checkbox when the target's kind is unknown. Combine with
  `situational: true` for bonuses with extra conditions beyond the kind (e.g.
  Animal Husbandry's "tame AND uncontrolled").
- `optionalRule` (string) — ties the effect to a world setting; currently
  `btaCaste` (the *By This Axe* p.56 dwarven caste rule). When the setting is
  off the effect stops contributing, no need to remove it from actors.
- `actsAs` (`diplomacy` | `intimidation` | `seduction` | `mysticAura`) — the power
  **is** that core proficiency under the hood (non-stacking). If the character
  lacks the base proficiency, the power **replaces that proficiency's checkbox
  name** in the roller and borrows its hardcoded mechanic (including the Mystic
  Aura bewitched kicker). If they already have the base proficiency, the power is
  redundant and doesn't double up. E.g. Glamorous Aura, Bedazzling Glamour.

The roller lists non-`actsAs` effects under a **Proficiencies & Powers** group
(badged 🖐). The test compendium ships examples: Beast Friendship, Animal
Husbandry, Folkways (situational, tone-scoped), plus class powers — Command of
Voice, Bedazzling Glamour, Glamorous Aura, Ancient Pacts (±greater variant),
Deathly Visage, the four Inhumanity tiers, and the three BTA caste items —
demonstrating `bewitched`, `alignmentSign`, `alignmentOnly`, `vs`, `actsAs`,
and `optionalRule`.

> Note: bonuses are read from **effects on the owned item/actor**, so a system or
> homebrew proficiency only contributes if it carries such an effect — the
> module's compendium copies do; add the effect to your own items to extend it.

## Racial & cross-species reactions

See the local rules extract (`acks-rules/acks-influence/ACKS-Reactions-Reference.md`) §6 for
the RAW: core ACKS II has **no** human/elf/dwarf reaction penalty — what exists
is **Inhumanity** (PC/JJ; reactions, loyalty, *and* morale), the optional BTA
dwarven-caste rule, type-scoped powers, and the MM hard hatreds. The module
implements exactly that, plus a campaign hook:

- **Target kind** — the roller detects the target's race/kind tokens from the
  class name (characters) or the [acks-monsters](https://github.com/NocTempre/acks-monsters)
  enhanced sheet typing plus name recognition (monsters), and shows them in an
  overridable field. `vs`-scoped effects gate on it automatically.
- **Campaign race relations** — the world setting **Campaign race relations
  (JSON)** takes directional rows:
  `[{"from":"dwarf","to":"elf","value":-1,"label":"Grudge of the Vaults"}]`
  (`from` = influencer race/category, `to` = target; **asymmetric by design** —
  add a mirror row if you want both directions). The best-matching row (exact
  race beats category) appears as an auto-populated "Racial relations" modifier
  on all three tones **and** the hiring/loyalty pages, mirroring Inhumanity's
  reach. Modules can contribute rows at runtime via
  `api.registerRaceRelations(rows)`; setting rows win ties.
- **BTA dwarven caste** — ships as compendium items (Highborn, Oathsworn/
  Craftborn/Workborn, Houseless) gated by the **By This Axe: dwarven caste
  reaction modifiers** world setting (default on; it is an optional rule).
- **Hard hatreds** (dwarf↔goblin, gnome↔kobold) surface as RAW chat notes —
  never a forced result.
- API: `kindOf(actor)`, `matchesKind(categories, tokens)`,
  `relationFor(kindOf(a), kindOf(b))`, `registerRaceRelations(rows)`.

## Rules reference

See the local rules extract (`acks-rules/acks-influence/ACKS-Reactions-Reference.md`) for the
consolidated, rules-complete reference this tool is built from (player rules
pp. 84–87 plus the Judges Journal GM screen).

## Layout

```
module.json                     manifest
scripts/
  module.mjs                    hooks: sheet button, /influence command, API
  influence-app.mjs             the ApplicationV2 roller
  constants.mjs                 tones, bands, time steps, modifier definitions
  actor-data.mjs                auto-population from actor/target (public paths)
templates/
  influence.hbs                 roller form
  influence-result.hbs          chat card
styles/influence.css
lang/en.json
packs/
  proficiencies/                compiled LevelDB test compendium (shipped)
  _source/proficiencies/        human-readable pack source
tools/build-packs.mjs           regenerates the compendium (dev-only)
acks-rules/acks-influence/ACKS-Reactions-Reference.md
```

## License

**Code:** © NocTempre — proprietary; all rights reserved except as granted to
Autarch LLC under the **ACKS II App License**. This module is **not** open source
or Open Game Content, and no license is granted to copy, redistribute, or reuse
its code. See [`LICENSE`](LICENSE).

**ACKS II content** is used under the **ACKS II App License**. ACKS, ACKS II, and
Adventurer Conqueror King System are trademarks of **Autarch LLC**.

**Unofficial** — this is an unofficial fan module, not published or endorsed by
Autarch LLC.

**Registration #:** _[pending registration]_

**Requires:** a legitimate copy of the ACKS II rules this module draws on —
Adventurer Conqueror King System II (ACKS II), reaction & influence rules
_[confirm exact publication title(s)]_. The module is not a substitute for the
books and is free to use.
