/* global game */
/**
 * Reads auto-populatable values from the influencing actor and the targeted
 * token's actor, using only public ACKS data paths (no system internals).
 */
import { INFLUENCE_MODIFIERS } from "./constants.mjs";

const GENERIC_IMG = "icons/svg/mystery-man.svg";

/** Classify a free-text alignment string into law / chaos / neutral. */
export function classifyAlignment(value) {
  const a = String(value ?? "").toLowerCase();
  if (a.includes("law")) return "law";
  if (a.includes("chaos") || a.includes("chaotic")) return "chaos";
  return "neutral";
}

function abilityMod(actor, key) {
  const mod = actor?.system?.scores?.[key]?.mod;
  return Number.isFinite(mod) ? mod : 0;
}

/** Diplomacy alignment modifier from the two parties' alignments (book rule). */
function alignmentModifier(charActor, targetActor) {
  if (!charActor || !targetActor) return 0;
  const c = classifyAlignment(charActor.system?.details?.alignment);
  const t = classifyAlignment(targetActor.system?.details?.alignment);
  if (c === "law" && (t === "law" || t === "neutral")) return 1;
  if ((c === "law" && t === "chaos") || (c === "chaos" && (t === "law" || t === "neutral"))) return -1;
  return 0;
}

/** Proficiency matchers against the actor's `ability` items. */
const PROFICIENCY_MATCHERS = Object.freeze({
  diplomacy: /^diplomacy$/i,
  intimidation: /^intimidat/i,
  seduction: /^seduction$/i,
  mysticAura: /^mystic\s*aura$/i,
  performanceArt: /^(performance|art)\b/i,
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

/**
 * Compute the raw context values used to resolve every `auto` modifier source.
 */
function buildContext(actor, targetActor) {
  return {
    cha: actor ? abilityMod(actor, "cha") : 0,
    targetWill: targetActor ? abilityMod(targetActor, "wis") : 0,
    alignment: alignmentModifier(actor, targetActor),
    profs: getProficiencies(actor),
  };
}

/** Resolve a single `auto` source string to its value. */
function resolveAutoValue(source, ctx) {
  if (source === "cha") return ctx.cha;
  if (source === "targetWill") return ctx.targetWill;
  if (source === "alignment") return ctx.alignment;
  if (source.startsWith("prof:")) return Boolean(ctx.profs[source.slice(5)]);
  return undefined;
}

/**
 * Build the per-tone default modifier values. Auto fields get detected values;
 * every other field gets its neutral default (false for checks, 0 otherwise).
 * @returns {{[tone:string]: {[key:string]: (number|boolean)}}}
 */
export function computeDefaults(actor, targetActor) {
  const ctx = buildContext(actor, targetActor);
  const defaults = {};
  for (const [tone, groups] of Object.entries(INFLUENCE_MODIFIERS)) {
    defaults[tone] = {};
    for (const group of groups) {
      for (const mod of group.mods) {
        let value = mod.type === "check" ? false : 0;
        if (mod.auto) {
          const resolved = resolveAutoValue(mod.auto, ctx);
          if (resolved !== undefined) value = resolved;
        }
        defaults[tone][mod.key] = value;
      }
    }
  }
  return defaults;
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
