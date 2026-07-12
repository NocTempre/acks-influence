/**
 * Build the module's compendium packs.
 *
 * Writes human-readable source JSON to packs/_source/<pack>/ and compiles each
 * into a Foundry v13 LevelDB pack at packs/<pack>/.
 *
 * Usage:  node tools/build-packs.mjs
 * Requires the dev dependency `classic-level` (see package.json / README).
 */
import { ClassicLevel } from "classic-level";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { MODULE_ID, REACTION_CHANGE_KEY } from "../scripts/constants.mjs";

const ROOT = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const BOOK_IMG = "icons/svg/book.svg";

/**
 * Build an embedded Active Effect that grants a reaction-roll modifier the
 * influence roller reads. `situational` effects render as GM-toggled checkboxes.
 */
function reactionEffect({ id, name, value, situational = true, tone = "all", label }) {
  return {
    _id: id,
    name,
    img: "icons/svg/aura.svg",
    changes: [{ key: REACTION_CHANGE_KEY, mode: 2, value: String(value), priority: 20 }],
    disabled: false,
    transfer: true,
    description: "",
    origin: null,
    duration: { startTime: null, seconds: null, rounds: null, turns: null },
    tint: "#ffffff",
    statuses: [],
    flags: { [MODULE_ID]: { situational, tone, label } },
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
    effect: reactionEffect({ id: "acksInflEffBeast", name: "Beast Friendship (reaction)", value: 2, situational: true, tone: "all", label: "Beast Friendship — target is a normal animal (+2)" }),
  },
  {
    id: "acksInflAnimHusb",
    name: "Animal Husbandry",
    description: "The character can care for and train animals. As an animal trainer he gains a +1 bonus to reaction rolls when approaching tame but uncontrolled animals of any type he can train.",
    effect: reactionEffect({ id: "acksInflEffAnimH", name: "Animal Husbandry (reaction)", value: 1, situational: true, tone: "all", label: "Animal Husbandry — tame, uncontrolled animal (+1)" }),
  },
  {
    id: "acksInflFolkways",
    name: "Folkways",
    description: "The character knows the customs of a particular urban settlement. He gains a +1 bonus to reaction rolls with 0th-level characters he encounters in his settlement. (Revised Rules proficiency, provided here for testing.)",
    effect: reactionEffect({ id: "acksInflEffFolkw", name: "Folkways (reaction)", value: 1, situational: true, tone: "all", label: "Folkways — 0th-level target in home settlement (+1)" }),
  },
  {
    id: "acksInflPresence",
    name: "Steely Presence (Class Power)",
    description: "Example class power: the character's commanding presence always aids intimidation. Demonstrates a non-situational, tone-specific reaction effect that the influence roller applies automatically.",
    effect: reactionEffect({ id: "acksInflEffPresc", name: "Steely Presence (reaction)", value: 1, situational: false, tone: "intimidation", label: "Steely Presence (+1 intimidation)" }),
  },
  { id: "acksInflPerformM", name: "Performance: Musical Instrument", description: "The character is a skilled performer. A demonstrated Performance or Art proficiency grants a +1 bonus when using Seduction with Mystic Aura or Seduction proficiency." },
  { id: "acksInflBargain0", name: "Bargaining", description: "The character is a shrewd negotiator. When bargaining with another bargainer, both make reaction rolls and the higher wins the discount. Grants +2 per selection on the reaction roll versus other bargainers." },
  { id: "acksInflBribery0", name: "Bribery", description: "The character is skilled at bribing officials. A bribe grants +1, +2, or +3 to reaction rolls for a day's, a week's, or a month's pay respectively. The attempt is politely deniable; he is only charged with the crime of bribery on an unmodified 2." },
];

function proficiencyDoc(p) {
  const now = Date.now();
  return {
    _id: p.id,
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
    effects: [], // embedded effects are stored as separate pack keys, not inline
    flags: {},
    ownership: { default: 0 },
    sort: 0,
    _stats: { systemId: "acks", createdTime: now, modifiedTime: now },
    _key: `!items!${p.id}`,
  };
}

/** The separate LevelDB entry for an item's embedded Active Effect. */
function effectEntry(itemId, effect) {
  return { ...effect, _key: `!items.effects!${itemId}.${effect._id}` };
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
    id: "acksInflMacro001",
    name: "Influence Roller",
    img: "icons/svg/chat.svg",
    command: MACRO_COMMAND,
  },
];

function macroDoc(m) {
  const now = Date.now();
  return {
    _id: m.id,
    name: m.name,
    type: "script",
    img: m.img,
    scope: "global",
    command: m.command,
    folder: null,
    flags: {},
    ownership: { default: 0 },
    sort: 0,
    _stats: { systemId: "acks", createdTime: now, modifiedTime: now },
    _key: `!macros!${m.id}`,
  };
}

/* -------------------------------------------- */
/*  Builder                                     */
/* -------------------------------------------- */

async function buildPack(packName, docs) {
  const srcDir = path.join(ROOT, "packs", "_source", packName);
  const dbDir = path.join(ROOT, "packs", packName);

  // Human-readable source JSON.
  fs.mkdirSync(srcDir, { recursive: true });
  for (const f of fs.readdirSync(srcDir).filter((f) => f.endsWith(".json"))) fs.rmSync(path.join(srcDir, f));
  for (const doc of docs) {
    const slug = doc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    fs.writeFileSync(path.join(srcDir, `${slug}.json`), JSON.stringify(doc, null, 2) + "\n");
  }

  // Compile the LevelDB pack.
  fs.rmSync(dbDir, { recursive: true, force: true });
  fs.mkdirSync(dbDir, { recursive: true });
  const db = new ClassicLevel(dbDir, { keyEncoding: "utf8", valueEncoding: "json" });
  await db.open();
  const batch = db.batch();
  for (const doc of docs) {
    const value = { ...doc };
    delete value._key;
    batch.put(doc._key, value);
  }
  await batch.write();
  await db.close();

  console.log(`Built pack "${packName}": ${docs.length} document(s) -> ${dbDir}`);
}

// Emit each proficiency item plus, as a SEPARATE pack entry, its embedded effect.
const proficiencyEntries = [];
for (const p of PROFICIENCIES) {
  proficiencyEntries.push(proficiencyDoc(p));
  if (p.effect) proficiencyEntries.push(effectEntry(p.id, p.effect));
}
await buildPack("proficiencies", proficiencyEntries);
await buildPack("macros", MACROS.map(macroDoc));
