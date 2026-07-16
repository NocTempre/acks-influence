/* global game */
/**
 * Reads auto-populatable values from the influencing actor and the targeted
 * token's actor, using only public ACKS data paths (no system internals).
 */
import { HENCHMAN_MONTHLY_WAGE, INFLUENCE_MODIFIERS, MODULE_ID, REACTION_CHANGE_KEY } from "./constants.mjs";
import { inferRace, optionalRuleEnabled, parseKindList } from "./racial.mjs";

const GENERIC_IMG = "icons/svg/mystery-man.svg";

/**
 * Alignment enum. Classify a free-text alignment by its (capitalized) first
 * letter: L → law, C → chaos, N → neutral; anything else (blank/unknown) → other.
 */
export const ALIGNMENT = Object.freeze({ LAW: "law", CHAOS: "chaos", NEUTRAL: "neutral", OTHER: "other" });

export function classifyAlignment(value) {
  const c = String(value ?? "").trim().charAt(0).toUpperCase();
  if (c === "L") return ALIGNMENT.LAW;
  if (c === "C") return ALIGNMENT.CHAOS;
  if (c === "N") return ALIGNMENT.NEUTRAL;
  return ALIGNMENT.OTHER;
}

function abilityMod(actor, key) {
  const mod = actor?.system?.scores?.[key]?.mod;
  return Number.isFinite(mod) ? mod : 0;
}

/**
 * Diplomacy alignment modifier: +1 when the two alignments match (same L/N/C),
 * -1 when they are opposed (Law vs Chaos), 0 otherwise (a Neutral mixed with a
 * non-matching alignment). Always overridable in the form.
 */
function alignmentModifier(charActor, targetActor) {
  if (!charActor || !targetActor) return 0;
  const c = classifyAlignment(charActor.system?.details?.alignment);
  const t = classifyAlignment(targetActor.system?.details?.alignment);
  // Unknown/undefined alignment can't establish a match or mismatch.
  if (c === ALIGNMENT.OTHER || t === ALIGNMENT.OTHER) return 0;
  if (c === t) return 1;
  if ((c === ALIGNMENT.LAW && t === ALIGNMENT.CHAOS) || (c === ALIGNMENT.CHAOS && t === ALIGNMENT.LAW)) return -1;
  return 0;
}

/** Proficiency matchers against the actor's `ability` items. */
const PROFICIENCY_MATCHERS = Object.freeze({
  diplomacy: /^diplomacy$/i,
  intimidation: /^intimidat/i,
  seduction: /^seduction$/i,
  mysticAura: /^mystic\s*aura$/i,
  performanceArt: /^(performance|art)\b/i,
  bribery: /^bribery/i,
  // Situational proficiencies (offered only when present).
  beastFriendship: /^beast\s*friendship/i,
  animalHusbandry: /^animal\s*husbandry/i,
  folkways: /^folkways/i,
});

/**
 * Detect which reaction-relevant proficiencies the actor possesses.
 * @returns {Record<string, boolean>}
 */
export function getProficiencies(actor) {
  const found = {};
  for (const key of Object.keys(PROFICIENCY_MATCHERS)) found[key] = false;
  if (!actor?.items) return found;
  for (const item of actor.items) {
    if (item.type !== "ability") continue;
    const name = item.name ?? "";
    for (const [key, re] of Object.entries(PROFICIENCY_MATCHERS)) {
      if (!found[key] && re.test(name)) found[key] = true;
    }
  }
  return found;
}

/**
 * The actor's HD (monsters) or class level (characters), used for the bribe fee.
 * Parses monster `system.hp.hd` strings like "3d8", "1/2", "2+1".
 */
export function getActorHD(actor) {
  if (!actor) return 0;
  if (actor.type === "character") return Number(actor.system?.details?.level) || 0;
  const hd = String(actor.system?.hp?.hd ?? "").trim();
  const frac = hd.match(/^(\d+)\s*\/\s*(\d+)/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const m = hd.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

/** Henchman monthly wage (gp) for a given HD/level, clamped to the table. */
export function monthlyWageForHD(hd) {
  const level = Math.max(0, Math.min(HENCHMAN_MONTHLY_WAGE.length - 1, Math.floor(Number(hd) || 0)));
  return HENCHMAN_MONTHLY_WAGE[level];
}

/** The first currently-targeted token's actor, if any. */
export function getTargetActor() {
  const targets = game.user?.targets ? Array.from(game.user.targets) : [];
  return targets[0]?.actor ?? null;
}

/**
 * Portraits/names for the influencer and target sides.
 * @param {Actor|null} actor    the influencing actor
 * @param {Actor|null} targetActor  the targeted actor
 */
export function resolveParties(actor, targetActor) {
  const influencer = actor
    ? { name: actor.name, img: actor.img || GENERIC_IMG }
    : { name: "Influencer", img: GENERIC_IMG };
  const target = targetActor
    ? { name: targetActor.name, img: targetActor.img || GENERIC_IMG }
    : { name: "Target", img: GENERIC_IMG };
  return { influencer, target };
}

/** The four hardcoded core proficiencies a power may stand in for (`actsAs`). */
const CORE_PROFS = ["diplomacy", "intimidation", "seduction", "mysticAura"];

/**
 * Compute the raw context values used to resolve every `auto` modifier source.
 * A power that `actsAs` a core proficiency makes that proficiency count as present.
 */
function buildContext(actor, targetActor) {
  const profs = { ...getProficiencies(actor) };
  const actsAs = getActsAsPowers(actor);
  for (const k of CORE_PROFS) if (actsAs[k]) profs[k] = true;
  return {
    cha: actor ? abilityMod(actor, "cha") : 0,
    targetWill: targetActor ? abilityMod(targetActor, "wis") : 0,
    // Intimidation reads the target's morale straight off the sheet (character
    // -4..+4, monster -6..+4); the field stays editable as a manual override.
    targetMorale: targetActor ? Number(targetActor.system?.details?.morale ?? 0) : 0,
    alignment: alignmentModifier(actor, targetActor),
    levelGap: levelGapModifier(actor, targetActor),
    age: ageModifier(actor, targetActor),
    profs,
  };
}

/**
 * Level/HD gap modifier: +1 when the character is 3+ levels/HD above the target,
 * -1 when 3+ below, else 0. Uses class level for characters, HD for monsters.
 */
function levelGapModifier(charActor, targetActor) {
  if (!charActor || !targetActor) return 0;
  const diff = getActorHD(charActor) - getActorHD(targetActor);
  if (diff >= 3) return 1;
  if (diff <= -3) return -1;
  return 0;
}

/* -------------------------------------------- */
/*  Age (Character Aging table, RR)             */
/* -------------------------------------------- */

// Lower bound (in years) of each age category: Youth, Adult, Middle-Aged, Old, Ancient.
const AGE_TABLE = Object.freeze({
  beastman: [12, 16, 31, 46, 61],
  dwarf: [15, 26, 51, 76, 116],
  elf: [15, 51], // Youth, Adult only
  human: [13, 18, 36, 56, 76],
  nobiran: [13, 18], // Youth, Adult only
  zaharan: [13, 18, 36, 56, 76],
});

/** The age-category index (0 = Youth … 4 = Ancient) for an actor. */
export function ageCategoryIndex(actor) {
  const bounds = AGE_TABLE[inferRace(actor)] ?? AGE_TABLE.human;
  const age = Number(actor?.system?.details?.age);
  if (!Number.isFinite(age)) return 1; // assume Adult when unknown
  let idx = 0;
  for (let i = 0; i < bounds.length; i++) if (age >= bounds[i]) idx = i;
  return idx;
}

/**
 * Age modifier for Seduction (±1 per age category). Defaults to the common case
 * that targets prefer youthful mates, so a younger character is +per category.
 * The GM flips the sign when the target prefers mature mates.
 */
function ageModifier(charActor, targetActor) {
  if (!charActor || !targetActor) return 0;
  // Age categories only apply within the Youth–Old range; clamp Ancient to Old.
  const c = Math.min(3, ageCategoryIndex(charActor));
  const t = Math.min(3, ageCategoryIndex(targetActor));
  return t - c; // + when the character is the younger category
}

/** Resolve a single `auto` source string to its value. */
function resolveAutoValue(source, ctx) {
  if (source === "cha") return ctx.cha;
  if (source === "targetWill") return ctx.targetWill;
  if (source === "targetMorale") return ctx.targetMorale;
  if (source === "alignment") return ctx.alignment;
  if (source === "levelGap") return ctx.levelGap;
  if (source === "age") return ctx.age;
  if (source.startsWith("prof:")) return Boolean(ctx.profs[source.slice(5)]);
  // Caller-supplied values (external modes): api.open(actor, {mode, ctx}).
  if (source.startsWith("ctx:")) {
    const value = ctx.external?.[source.slice(4)];
    return value === undefined ? 0 : Number(value) || 0;
  }
  return undefined;
}

/**
 * Build the per-tone default modifier values. Auto fields get detected values;
 * effect-granted fields use their declared default; everything else gets its
 * neutral default (false for checks, 0 otherwise).
 * @param {Actor|null} actor
 * @param {Actor|null} targetActor
 * @param {Record<string, Array>} modConfig  per-tone groups (static + effects)
 * @returns {{[tone:string]: {[key:string]: (number|boolean)}}}
 */
export function computeDefaults(actor, targetActor, modConfig = INFLUENCE_MODIFIERS, external = null) {
  const ctx = buildContext(actor, targetActor);
  ctx.external = external ?? {};
  const defaults = {};
  for (const [tone, groups] of Object.entries(modConfig)) {
    defaults[tone] = {};
    for (const group of groups) {
      for (const mod of group.mods) {
        let value = mod.type === "check" ? false : 0;
        if (mod.auto) {
          const resolved = resolveAutoValue(mod.auto, ctx);
          if (resolved !== undefined) value = resolved;
        } else if (Object.hasOwn(mod, "default")) {
          value = mod.default;
        }
        defaults[tone][mod.key] = value;
      }
    }
  }
  return defaults;
}

/**
 * Scan an actor's active effects for reaction-roll modifiers (see
 * REACTION_CHANGE_KEY). Returns a flat list; the app groups them per tone.
 * @returns {Array<{id:string,label:string,value:number,situational:boolean,tone:string}>}
 */
export function getEffectReactionMods(actor) {
  if (!actor) return [];
  const out = [];
  const effects = actor.appliedEffects ?? actor.effects ?? [];
  let idx = 0;
  for (const effect of effects) {
    if (effect.disabled) continue;
    const f = effect.flags?.[MODULE_ID] ?? {};
    // Effects tied to an optional rule (e.g. BTA dwarven caste) obey its setting.
    if (f.optionalRule && !optionalRuleEnabled(f.optionalRule)) {
      idx++;
      continue;
    }
    let ci = 0;
    for (const change of effect.changes ?? []) {
      // Effects that stand in for a core proficiency are handled by getActsAsPowers.
      if (change.key === REACTION_CHANGE_KEY && !f.actsAs) {
        const value = Number(change.value) || 0;
        if (value) {
          // `tone` may be "all", a single tone, an array, or a comma-separated list.
          const raw = f.tone ?? "all";
          const tones = (Array.isArray(raw) ? raw : String(raw).split(","))
            .map((t) => String(t).trim().toLowerCase())
            .filter(Boolean);
          const vs = f.vs ? parseKindList(f.vs) : null;
          out.push({
            id: `eff:${effect.id ?? idx}:${ci}`,
            label: f.label || effect.name || "Effect",
            value,
            situational: f.situational !== false,
            tones: tones.length ? tones : ["all"],
            bewitched: f.bewitched === true,
            alignmentSign: f.alignmentSign ? String(f.alignmentSign).toLowerCase() : null,
            // Target-kind scoping: active only when the target matches (see kindOf).
            vs: vs?.length ? vs : null,
            // Alignment gating (not sign-flipping): active only vs this alignment.
            alignmentOnly: f.alignmentOnly ? String(f.alignmentOnly).toLowerCase() : null,
          });
        }
      }
      ci++;
    }
    idx++;
  }
  return out;
}

/**
 * Powers whose effect declares `flags.acks-influence.actsAs: <coreProf>` — a
 * proficiency granted as a class power (non-stacking). Returns a map of core
 * proficiency key → display label, used to fill in / relabel that prof's box.
 * @returns {Record<string, string>}
 */
export function getActsAsPowers(actor) {
  const map = {};
  if (!actor) return map;
  const effects = actor.appliedEffects ?? actor.effects ?? [];
  for (const effect of effects) {
    if (effect.disabled) continue;
    const f = effect.flags?.[MODULE_ID];
    if (!f?.actsAs) continue;
    const key = String(f.actsAs);
    if (!map[key]) map[key] = f.label || effect.name || key;
  }
  return map;
}

/** The set of modifier keys (per tone) that are auto-populated, for UI badges. */
export function autoKeysByTone() {
  const map = {};
  for (const [tone, groups] of Object.entries(INFLUENCE_MODIFIERS)) {
    map[tone] = new Set();
    for (const group of groups) {
      for (const mod of group.mods) {
        if (mod.auto) map[tone].add(mod.key);
      }
    }
  }
  return map;
}
