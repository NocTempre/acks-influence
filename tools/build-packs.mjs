/**
 * Build the module's proficiency compendium.
 *
 * Writes human-readable source JSON to packs/_source/proficiencies/ and compiles
 * it into a Foundry v13 LevelDB pack at packs/proficiencies/.
 *
 * Usage:  node tools/build-packs.mjs
 * Requires the dev dependency `classic-level` (see package.json / README).
 */
import { ClassicLevel } from "classic-level";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const SRC_DIR = path.join(ROOT, "packs", "_source", "proficiencies");
const DB_DIR = path.join(ROOT, "packs", "proficiencies");
const IMG = "icons/svg/book.svg";

/**
 * The reaction-relevant proficiencies. `id` is a stable 16-char Foundry id so
 * rebuilds are deterministic. Names match the ACKS system items so auto-detection
 * behaves identically with the real system compendium.
 */
const PROFICIENCIES = [
  {
    id: "acksInflDiplomcy",
    name: "Diplomacy",
    type: "general",
    description:
      "The character is smooth-tongued and familiar with protocol. He receives a +1 bonus on all reaction rolls when he attempts to parley. This bonus stacks with Mystic Aura, but not with Intimidation or Seduction.",
  },
  {
    id: "acksInflIntimdte",
    name: "Intimidate",
    type: "general",
    description:
      "The character knows how to bully others. He receives a +1 bonus on reaction rolls when threatening violence or dire consequences. The targets must be less than 5 HD, or the character and his allies must outnumber or grossly outrank the targets. Stacks with Mystic Aura, but not Diplomacy or Seduction.",
  },
  {
    id: "acksInflSeductn0",
    name: "Seduction",
    type: "general",
    description:
      "The character is naturally alluring or a practiced seducer. He receives a +1 bonus on reaction rolls when interacting with others potentially attracted to him. Stacks with Mystic Aura, but not Diplomacy or Intimidation.",
  },
  {
    id: "acksInflMystcAur",
    name: "Mystic Aura",
    type: "general",
    description:
      "The character projects his magical power to cause awe. He gains a +1 bonus to reaction rolls to impress and intimidate. If this bonus brings the total to 12 or more, the subjects act as if bewitched while in his presence.",
  },
  {
    id: "acksInflBeastFrn",
    name: "Beast Friendship",
    type: "general",
    description:
      "The character is well-schooled in the natural world and understands beasts. He gains +2 to all reaction rolls when encountering normal animals and can take animals as henchmen.",
  },
  {
    id: "acksInflAnimHusb",
    name: "Animal Husbandry",
    type: "general",
    description:
      "The character can care for and train animals. As an animal trainer he gains a +1 bonus to reaction rolls when approaching tame but uncontrolled animals of any type he can train.",
  },
  {
    id: "acksInflFolkways",
    name: "Folkways",
    type: "general",
    description:
      "The character knows the customs of a particular urban settlement. He gains a +1 bonus to reaction rolls with 0th-level characters he encounters in his settlement. (Revised Rules proficiency, provided here for testing.)",
  },
  {
    id: "acksInflPerformM",
    name: "Performance: Musical Instrument",
    type: "general",
    description:
      "The character is a skilled performer. A demonstrated Performance or Art proficiency grants a +1 bonus when using Seduction with Mystic Aura or Seduction proficiency.",
  },
  {
    id: "acksInflBargain0",
    name: "Bargaining",
    type: "general",
    description:
      "The character is a shrewd negotiator. When bargaining with another bargainer, both make reaction rolls and the higher wins the discount. Grants +2 per selection on the reaction roll versus other bargainers.",
  },
  {
    id: "acksInflBribery0",
    name: "Bribery",
    type: "general",
    description:
      "The character is skilled at bribing officials. A bribe grants +1, +2, or +3 to reaction rolls for a day's, a week's, or a month's pay respectively. The attempt is politely deniable; he is only charged with the crime of bribery on an unmodified 2.",
  },
];

function buildDoc(p) {
  const now = Date.now();
  return {
    _id: p.id,
    name: p.name,
    type: "ability",
    img: IMG,
    system: {
      proficiencytype: p.type,
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
    effects: [],
    flags: {},
    ownership: { default: 0 },
    sort: 0,
    _stats: { systemId: "acks", createdTime: now, modifiedTime: now },
    _key: `!items!${p.id}`,
  };
}

// 1) Write human-readable source JSON.
fs.mkdirSync(SRC_DIR, { recursive: true });
for (const f of fs.readdirSync(SRC_DIR).filter((f) => f.endsWith(".json"))) {
  fs.rmSync(path.join(SRC_DIR, f));
}
const docs = PROFICIENCIES.map(buildDoc);
for (const doc of docs) {
  const slug = doc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  fs.writeFileSync(path.join(SRC_DIR, `${slug}.json`), JSON.stringify(doc, null, 2) + "\n");
}

// 2) Compile the LevelDB pack.
fs.rmSync(DB_DIR, { recursive: true, force: true });
fs.mkdirSync(DB_DIR, { recursive: true });
const db = new ClassicLevel(DB_DIR, { keyEncoding: "utf8", valueEncoding: "json" });
await db.open();
const batch = db.batch();
for (const doc of docs) {
  const value = { ...doc };
  delete value._key;
  batch.put(doc._key, value);
}
await batch.write();
await db.close();

console.log(`Wrote ${docs.length} source items to ${SRC_DIR}`);
console.log(`Compiled LevelDB pack at ${DB_DIR}`);
