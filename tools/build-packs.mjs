/**
 * Build the module's compendium packs.
 *
 * Writes source JSON to packs/_source/<pack>/ (one file per primary document)
 * and compiles each into a Foundry LevelDB pack at packs/<pack>/ using the
 * official Foundry CLI.
 *
 * Only the macro pack is built. The former "Influence Proficiencies (Test)"
 * compendium stopped shipping on 2026-07-19: acks-lib + acks-abilities +
 * acks-content now own ability import, and a placeholder compendium alongside
 * that path just gives GMs duplicate copies of abilities content will import
 * properly. Reference copies of the effect structures live at
 * acks-rules/acks-influence/compendium-reference/.
 *
 * The effect convention those items demonstrated is unchanged and still
 * documented in the README ("Reaction-granting effects"); the roller reads it
 * from whatever items a world actually has. Reference copies of the removed
 * items are kept locally as the specification acks-content's authored specs
 * should reproduce (docs/SOCIAL_ROLLS_AUDIT.md §4.3).
 *
 * Usage:  node tools/build-packs.mjs   (requires dev deps, see package.json)
 */
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const now = Date.now();
const STATS = { systemId: "acks", createdTime: now, modifiedTime: now };

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

await buildPack("macros", MACROS);
