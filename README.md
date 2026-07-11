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
- **Two roll types.**
  - *Initial reaction* — the 2d6 result sets the attitude directly.
  - *Attempt to influence* — the result shifts the current attitude 1–2 rungs,
    the tracker advances, and the attempt counter (with its **time cost**) steps
    forward.
- **Auto-population with overrides.** Charisma, target Will, alignment match, and
  the relevant proficiencies (Diplomacy, Intimidate, Seduction, Mystic Aura,
  Performance/Art) are detected from the character and the currently-targeted
  token. Every value is editable, and a **Reset to defaults** button re-detects
  them (picking up a newly-selected target). Auto fields are badged ✨; overridden
  ones are highlighted.
- **Situational proficiency modifiers.** Beast Friendship (+2 vs normal animals),
  Animal Husbandry (+1 vs tame animals), and Folkways (+1 vs 0th-level townsfolk)
  appear **only when the character actually has that proficiency**, default
  unticked — the GM checks the box when it applies. They never clutter the sheet
  of a character who lacks them.
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

## Rules reference

See [`docs/ACKS-Reactions-Reference.md`](docs/ACKS-Reactions-Reference.md) for the
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
docs/ACKS-Reactions-Reference.md
```
