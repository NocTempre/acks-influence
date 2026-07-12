/**
 * Build the module's compendium packs.
 *
 * Writes source JSON to packs/_source/<pack>/ (one file per primary document,
 * embedded effects inline with their own `_key`) and compiles each into a
 * Foundry LevelDB pack at packs/<pack>/ using the official Foundry CLI, which
 * flattens embedded documents into the correct separate-key layout.
 *
 * Usage:  node tools/build-packs.mjs   (requires dev deps, see package.json)
 */
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { MODULE_ID, REACTION_CHANGE_KEY } from "../scripts/constants.mjs";

const ROOT = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const BOOK_IMG = "icons/svg/book.svg";
const now = Date.now();
const STATS = { systemId: "acks", createdTime: now, modifiedTime: now };

/**
 * A complete embedded Active Effect that grants a reaction-roll modifier the
 * influence roller reads. `situational` effects render as GM-toggled checkboxes.
 */
function reactionEffect(itemId, { id, name, value = 0, situational = true, tone = "all", label, bewitched = false, alignmentSign = null, actsAs = null }) {
  const flags = { situational, tone, label };
  // Optional extras (see docs/README "Reaction-granting effects"):
  if (bewitched) flags.bewitched = true; // total 12+ → subject bewitched/charmed
  if (alignmentSign) flags.alignmentSign = alignmentSign; // +value if target matches, else -value
  if (actsAs) flags.actsAs = actsAs; // stands in for a core proficiency (non-stacking)
  return {
    _id: id,
    _key: `!items.effects!${itemId}.${id}`,
    name,
    type: "base",
    img: "icons/svg/aura.svg",
    system: {},
    changes: [{ key: REACTION_CHANGE_KEY, mode: 2, value: String(value), priority: 20 }],
    disabled: false,
    transfer: true,
    duration: { startTime: null, seconds: null, combat: null, rounds: null, turns: null, startRound: null, startTurn: null },
    description: "",
    origin: null,
    tint: "#ffffff",
    statuses: [],
    sort: 0,
    flags: { [MODULE_ID]: flags },
    _stats: { ...STATS },
  };
}

/* -------------------------------------------- */
/*  Proficiency items                           */
/* -------------------------------------------- */

const PROFICIENCIES = [
  { id: "acksInflDiplomcy", name: "Diplomacy", description: "The character is smooth-tongued and familiar with protocol. He receives a +1 bonus on all reaction rolls when he attempts to parley. This bonus stacks with Mystic Aura, but not with Intimidation or Seduction." },
  { id: "acksInflIntimdte", name: "Intimidate", description: "The character knows how to bully others. He receives a +1 bonus on reaction rolls when threatening violence or dire consequences. The targets must be less than 5 HD, or the character and his allies must outnumber or grossly outrank the targets. Stacks with Mystic Aura, but not Diplomacy or Seduction." },
  { id: "acksInflSeductn0", name: "Seduction", description: "The character is naturally alluring or a practiced seducer. He receives a +1 bonus on reaction rolls when interacting with others potentially attracted to him. Stacks with Mystic Aura, but not Diplomacy or Intimidation." },
  { id: "acksInflMystcAur", name: "Mystic Aura", description: "The character projects his magical power to cause awe. He gains a +1 bonus to reaction rolls to impress and intimidate. If this bonus brings the total to 12 or more, the subjects act as if bewitched while in his presence." },
  {
    id: "acksInflBeastFrn",
    name: "Beast Friendship",
    description: "The character is well-schooled in the natural world and understands beasts. He gains +2 to all reaction rolls when encountering normal animals and can take animals as henchmen.",
    effect: { id: "acksInflEffBeast", name: "Beast Friendship (reaction)", value: 2, situational: true, tone: "diplomacy,intimidation", label: "Beast Friendship — target is a normal animal (+2)" },
  },
  {
    id: "acksInflAnimHusb",
    name: "Animal Husbandry",
    description: "The character can care for and train animals. As an animal trainer he gains a +1 bonus to reaction rolls when approaching tame but uncontrolled animals of any type he can train.",
    effect: { id: "acksInflEffAnimH", name: "Animal Husbandry (reaction)", value: 1, situational: true, tone: "diplomacy,intimidation", label: "Animal Husbandry — tame, uncontrolled animal (+1)" },
  },
  {
    id: "acksInflFolkways",
    name: "Folkways",
    description: "The character knows the customs of a particular urban settlement. He gains a +1 bonus to reaction rolls with 0th-level characters he encounters in his settlement. (Revised Rules proficiency, provided here for testing.)",
    effect: { id: "acksInflEffFolkw", name: "Folkways (reaction)", value: 1, situational: true, tone: "diplomacy", label: "Folkways — 0th-level target in home settlement (+1)" },
  },
  { id: "acksInflPerformM", name: "Performance: Musical Instrument", description: "The character is a skilled performer. A demonstrated Performance or Art proficiency grants a +1 bonus when using Seduction with Mystic Aura or Seduction proficiency." },
  { id: "acksInflBargain0", name: "Bargaining", description: "The character is a shrewd negotiator. When bargaining with another bargainer, both make reaction rolls and the higher wins the discount. Grants +2 per selection on the reaction roll versus other bargainers." },
  { id: "acksInflBribery0", name: "Bribery", description: "The character is skilled at bribing officials. A bribe grants +1, +2, or +3 to reaction rolls for a day's, a week's, or a month's pay respectively. The attempt is politely deniable; he is only charged with the crime of bribery on an unmodified 2." },
  // --- Class powers that modify reaction rolls (JJ Powers) ---
  {
    id: "acksInflCmdVoice",
    name: "Command of Voice (Power)",
    description: "The character gains a +1 bonus to reaction rolls with creatures he speaks to. If this bonus brings the total to 12 or more, they act as if charmed while in his presence.",
    effect: { id: "acksInflEffCmdVc", name: "Command of Voice (reaction)", value: 1, situational: false, tone: "all", label: "Command of Voice (+1)", bewitched: true },
  },
  {
    id: "acksInflBedazzle",
    name: "Bedazzling Glamour (Power)",
    description: "While active, the character's magical glamour grants a +1 bonus to all reaction rolls and ignores reaction penalties from permanent wounds. Does not stack with Mystic Aura — under the hood it IS Mystic Aura as a power.",
    effect: { id: "acksInflEffBdzGl", name: "Bedazzling Glamour (Mystic Aura)", value: 1, situational: false, tone: "all", label: "Bedazzling Glamour", actsAs: "mysticAura" },
  },
  {
    id: "acksInflGlamAura",
    name: "Glamorous Aura (Power)",
    description: "The character projects an aura that awes, bedazzles, and seduces. A Mystic Aura variant that does not stack with it: +1 to impress/intimidate/seduce, and if the total reaches 12 or more the subjects act as if bewitched.",
    effect: { id: "acksInflEffGlmAu", name: "Glamorous Aura (Mystic Aura)", value: 1, situational: false, tone: "all", label: "Glamorous Aura", actsAs: "mysticAura", bewitched: true },
  },
  {
    id: "acksInflAncPacts",
    name: "Ancient Pacts (Power)",
    description: "The character gains a +1 bonus to reaction rolls when encountering intelligent Chaotic monsters.",
    effect: { id: "acksInflEffAncPc", name: "Ancient Pacts (reaction)", value: 1, situational: true, tone: "all", label: "Ancient Pacts — vs intelligent Chaotic monsters (+1)" },
  },
  {
    id: "acksInflDthVisag",
    name: "Deathly Visage (Power)",
    description: "The character suffers a -2 on reaction rolls versus non-Chaotic beings and enjoys +2 to reaction rolls with Chaotic beings. The sign follows the target's alignment automatically.",
    effect: { id: "acksInflEffDthVs", name: "Deathly Visage (reaction)", value: 2, situational: true, tone: "all", label: "Deathly Visage (±2 by target alignment)", alignmentSign: "chaos" },
  },
];

function proficiencyDoc(p) {
  return {
    _id: p.id,
    _key: `!items!${p.id}`,
    name: p.name,
    type: "ability",
    img: BOOK_IMG,
    system: {
      proficiencytype: "general",
      favorite: false,
      pattern: "white",
      requirements: "",
      roll: "",
      rollType: "result",
      rollTarget: 0,
      blindroll: false,
      description: `<p>${p.description}</p>`,
      save: "",
      _schemaVersion: 3,
    },
    effects: p.effect ? [reactionEffect(p.id, p.effect)] : [],
    flags: {},
    ownership: { default: 0 },
    sort: 0,
    _stats: { ...STATS },
  };
}

/* -------------------------------------------- */
/*  Macros                                      */
/* -------------------------------------------- */

const MACRO_COMMAND = `// Open the ACKS Influence roller for the selected/assigned actor.
const actor = canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
const api = game.modules.get("acks-influence")?.api ?? globalThis.acksInfluence;
if (api?.open) api.open(actor);
else ui.notifications.error("ACKS Influence & Reactions module is not active/enabled.");`;

const MACROS = [
  {
    _id: "acksInflMacro001",
    _key: "!macros!acksInflMacro001",
    name: "Influence Roller",
    type: "script",
    img: "icons/skills/social/diplomacy-handshake-yellow.webp",
    scope: "global",
    command: MACRO_COMMAND,
    folder: null,
    flags: {},
    ownership: { default: 0 },
    sort: 0,
    _stats: { ...STATS },
  },
];

/* -------------------------------------------- */
/*  Builder                                     */
/* -------------------------------------------- */

async function buildPack(packName, docs) {
  const srcDir = path.join(ROOT, "packs", "_source", packName);
  const dbDir = path.join(ROOT, "packs", packName);

  fs.mkdirSync(srcDir, { recursive: true });
  for (const f of fs.readdirSync(srcDir).filter((f) => f.endsWith(".json"))) fs.rmSync(path.join(srcDir, f));
  for (const doc of docs) {
    const slug = doc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    fs.writeFileSync(path.join(srcDir, `${slug}.json`), JSON.stringify(doc, null, 2) + "\n");
  }

  fs.rmSync(dbDir, { recursive: true, force: true });
  await compilePack(srcDir, dbDir, { recursive: false, log: false });
  console.log(`Built pack "${packName}": ${docs.length} document(s) -> ${dbDir}`);
}

await buildPack("proficiencies", PROFICIENCIES.map(proficiencyDoc));
await buildPack("macros", MACROS);
