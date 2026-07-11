/**
 * Static rules data for the ACKS II influence rolls.
 * Sourced from the player rules (pp. 84-87) and the Judges Journal GM screen.
 * See docs/ACKS-Reactions-Reference.md for the full reference.
 */

export const MODULE_ID = "acks-influence";

/** The three tones a spokesperson can adopt when attempting to influence. */
export const INFLUENCE_TONE = Object.freeze({
  DIPLOMACY: "diplomacy",
  INTIMIDATION: "intimidation",
  SEDUCTION: "seduction",
});

export const INFLUENCE_TONE_CHOICES = Object.freeze([
  { value: INFLUENCE_TONE.DIPLOMACY, label: "ACKS-INFLUENCE.tone.diplomacy" },
  { value: INFLUENCE_TONE.INTIMIDATION, label: "ACKS-INFLUENCE.tone.intimidation" },
  { value: INFLUENCE_TONE.SEDUCTION, label: "ACKS-INFLUENCE.tone.seduction" },
]);

/** The two ways the tool can be used. */
export const INFLUENCE_MODE = Object.freeze({
  INITIAL: "initial",
  CONTINUING: "continuing",
});

export const INFLUENCE_MODE_CHOICES = Object.freeze([
  { value: INFLUENCE_MODE.INITIAL, label: "ACKS-INFLUENCE.mode.initial" },
  { value: INFLUENCE_MODE.CONTINUING, label: "ACKS-INFLUENCE.mode.continuing" },
]);

/**
 * The attitude ladder, most negative (index 0) to most positive (index 4).
 * Labels differ by tone for the two upper rungs.
 */
export const INFLUENCE_ATTITUDE_LABELS = Object.freeze({
  [INFLUENCE_TONE.DIPLOMACY]: ["Hostile", "Unfriendly", "Neutral", "Indifferent", "Friendly"],
  [INFLUENCE_TONE.INTIMIDATION]: ["Hostile", "Unfriendly", "Neutral", "Intimidated", "Overawed"],
  [INFLUENCE_TONE.SEDUCTION]: ["Hostile", "Unfriendly", "Neutral", "Indifferent", "Friendly"],
});

/** Roll modifier contributed by the target's current attitude. */
export const INFLUENCE_RELATIONSHIP_MOD = Object.freeze([-2, -1, 0, 1, 2]);

/**
 * Reaction bands for a 2d6 (+ modifiers) influence roll.
 * - `initialIndex` is the resulting attitude when establishing an initial reaction.
 * - `shift` is the number of ladder steps moved in CONTINUING mode. The 6-8 band
 *   is special: it always shifts one step *towards* Neutral (index 2).
 */
export const INFLUENCE_BANDS = Object.freeze([
  { key: "2-", min: -Infinity, max: 2, initialIndex: 0, shift: -2, towardNeutral: false },
  { key: "3-5", min: 3, max: 5, initialIndex: 1, shift: -1, towardNeutral: false },
  { key: "6-8", min: 6, max: 8, initialIndex: 2, shift: 0, towardNeutral: true },
  { key: "9-11", min: 9, max: 11, initialIndex: 3, shift: 1, towardNeutral: false },
  { key: "12+", min: 12, max: Infinity, initialIndex: 4, shift: 2, towardNeutral: false },
]);

/** Per-tone descriptive text for each reaction band. */
export const INFLUENCE_BAND_LABELS = Object.freeze({
  [INFLUENCE_TONE.DIPLOMACY]: {
    "2-": "Hostile, attacks",
    "3-5": "Unfriendly, may attack",
    "6-8": "Neutral, uncertain",
    "9-11": "Indifferent, uninterested",
    "12+": "Friendly, helpful",
  },
  [INFLUENCE_TONE.INTIMIDATION]: {
    "2-": "Hostile, attacks",
    "3-5": "Unfriendly, may attack",
    "6-8": "Neutral, uncertain",
    "9-11": "Intimidated, escapes if possible",
    "12+": "Overawed, helpful",
  },
  [INFLUENCE_TONE.SEDUCTION]: {
    "2-": "Hostile, attacks or calls for aid",
    "3-5": "Unfriendly, insults or rejects",
    "6-8": "Neutral, remains open",
    "9-11": "Indifferent, but secretly interested",
    "12+": "Friendly, helpful",
  },
});

/**
 * Time cost of the Nth attempt to influence (Judges Journal GM screen).
 * The screen lists five steps; longer campaigns escalate at the Judge's discretion.
 */
export const INFLUENCE_TIME_STEPS = Object.freeze([
  { value: 1, label: "1st attempt — 1 round (1 minute)" },
  { value: 2, label: "2nd attempt — 1 turn (10 minutes)" },
  { value: 3, label: "3rd attempt — 6 turns (1 hour)" },
  { value: 4, label: "4th attempt — 8 hours (1 day)" },
  { value: 5, label: "5th attempt — 5 days (1 week)" },
]);

/**
 * Exhaustive per-tone modifier definitions used to build the influence form.
 *
 * `type` determines how a modifier's contribution is computed:
 * - `check`  : boolean; contributes `value` when checked, otherwise 0.
 * - `select` : mutually-exclusive options; contributes the chosen value.
 * - `signed` : free number input; contributes the value as typed (may be negative).
 * - `factor` : magnitude input; contributes `factor * value`.
 *
 * `auto` marks a field that can be pre-filled from the actor/target. Its value is
 * one of the sources understood by resolveAutoValue() in actor-data.mjs:
 *   "cha", "targetWill", "alignment", "prof:<name>".
 */
/**
 * Situational reaction bonuses from proficiencies that depend on *what the
 * target is* (a normal animal, a townsfolk, ...). Shared by all three tones and
 * left un-auto because they can't be inferred from the actor alone. See
 * docs/ACKS-Reactions-Reference.md §5.3.
 */
const SITUATIONAL_PROFICIENCIES = {
  group: "Situational Proficiencies",
  mods: [
    { key: "beastFriendship", type: "check", label: "Beast Friendship — target is a normal animal (+2)", value: 2, requiresProf: "beastFriendship" },
    { key: "animalTrainer", type: "check", label: "Animal Husbandry — tame, uncontrolled animal (+1)", value: 1, requiresProf: "animalHusbandry" },
    { key: "folkways", type: "check", label: "Folkways — 0th-level target in home settlement (+1)", value: 1, requiresProf: "folkways" },
  ],
};

export const INFLUENCE_MODIFIERS = Object.freeze({
  [INFLUENCE_TONE.DIPLOMACY]: [
    {
      group: "Alignment",
      mods: [
        {
          key: "alignment",
          type: "select",
          label: "Alignment match / mismatch",
          auto: "alignment",
          options: [
            { label: "—", value: 0 },
            { label: "Lawful character, Lawful/Neutral target (+1)", value: 1 },
            { label: "Opposed alignments (-1)", value: -1 },
          ],
        },
      ],
    },
    {
      group: "Location",
      mods: [
        { key: "trespassing", type: "check", label: "Trespassing in target's lair (-1)", value: -1 },
        { key: "ownLair", type: "check", label: "Character is in own lair (+1)", value: 1 },
      ],
    },
    {
      group: "Authority",
      mods: [
        { key: "legalAuthority", type: "signed", label: "Legal authority over target (+1 or more)" },
        { key: "owesFavors", type: "factor", factor: -1, label: "Unrequited favors owed to target (-1 each)" },
        { key: "targetAuthority", type: "signed", label: "Target has authority over character (-1 or more)" },
        { key: "targetOwesFavors", type: "factor", factor: 1, label: "Unrequited favors target owes (+1 each)" },
      ],
    },
    {
      group: "Attributes & Proficiencies",
      mods: [
        { key: "charisma", type: "signed", label: "Charisma modifier", auto: "cha" },
        { key: "bribe", type: "signed", label: "Appropriate bribe (+1 to +3)" },
        { key: "diplomacyProf", type: "check", label: "Diplomacy proficiency (+1)", value: 1, auto: "prof:diplomacy" },
        { key: "mysticAura", type: "check", label: "Mystic Aura proficiency (+1)", value: 1, auto: "prof:mysticAura" },
        { key: "targetWill", type: "factor", factor: -1, label: "Target's Will modifier (-Mod)", auto: "targetWill" },
      ],
    },
    {
      group: "Threat",
      mods: [
        { key: "brandishing", type: "check", label: "Brandishing a weapon (-1)", value: -1 },
        { key: "believesHarmed", type: "check", label: "Target believes character harmed friends (-1)", value: -1 },
        { key: "evidenceHarmed", type: "check", label: "Evidence character harmed friends (-2)", value: -2 },
        { key: "personallyHarmed", type: "signed", label: "Target personally harmed by character (-5 or more)" },
      ],
    },
    SITUATIONAL_PROFICIENCIES,
  ],
  [INFLUENCE_TONE.INTIMIDATION]: [
    {
      group: "Advantage",
      mods: [
        {
          key: "outnumber",
          type: "select",
          label: "Character & party outnumber target(s)",
          options: [
            { label: "—", value: 0 },
            { label: "Outnumber (+1)", value: 1 },
            { label: "By 3:2 or more (+2)", value: 2 },
            { label: "By 3:1 or more (+5)", value: 5 },
          ],
        },
        { key: "ownLair", type: "check", label: "Character is in own lair (+1)", value: 1 },
        { key: "brandishWeapon", type: "check", label: "Brandishing a weapon (+1)", value: 1 },
        { key: "brandishMagic", type: "check", label: "Brandishing magic items (+1)", value: 1 },
        { key: "targetAtDisadvantage", type: "signed", label: "Target at disadvantage; blackmail, tied up (+1 or more)" },
        { key: "legalAuthority", type: "signed", label: "Legal authority over target (+1 or more)" },
        { key: "higherLevel", type: "signed", label: "Significantly higher level than target, 3+ HD (+1 or more)" },
      ],
    },
    {
      group: "Target",
      mods: [
        { key: "targetMorale", type: "factor", factor: -1, label: "Target's Morale Score (-Score)" },
        { key: "targetWill", type: "factor", factor: -1, label: "Target's Will modifier (-Mod)", auto: "targetWill" },
        { key: "witnessedKill", type: "check", label: "Target witnessed character kill/torture associates (+1)", value: 1 },
        { key: "targetOwnLair", type: "check", label: "Target is in own lair (-1)", value: -1 },
        { key: "targetArmed", type: "check", label: "Target is armed (-1)", value: -1 },
        { key: "targetHasMagic", type: "check", label: "Target has spells or magic items available (-1)", value: -1 },
        {
          key: "targetOutnumber",
          type: "select",
          label: "Target & friends outnumber character & party",
          options: [
            { label: "—", value: 0 },
            { label: "Outnumber (-1)", value: -1 },
            { label: "By 3:2 or more (-2)", value: -2 },
            { label: "By 3:1 or more (-5)", value: -5 },
          ],
        },
        { key: "charAtDisadvantage", type: "signed", label: "Target has character at disadvantage; trump card, helpless (-1 or more)" },
        { key: "targetLegalAuthority", type: "signed", label: "Target has legal authority over character (-1 or more)" },
        { key: "targetHigherLevel", type: "signed", label: "Target significantly higher level, 3+ HD (-1 or more)" },
        { key: "lossOfFace", type: "signed", label: "Target will suffer loss of face if submits (-1 or more)" },
        { key: "punishedIfSubmits", type: "signed", label: "Target horrendously punished/killed if submits (-5 or more)" },
      ],
    },
    {
      group: "Attributes & Proficiencies",
      mods: [
        { key: "charisma", type: "signed", label: "Charisma modifier", auto: "cha" },
        { key: "intimidationProf", type: "check", label: "Intimidation proficiency (+1; target <5 HD or you outnumber/outrank)", value: 1, auto: "prof:intimidation" },
        { key: "mysticAura", type: "check", label: "Mystic Aura proficiency (+1)", value: 1, auto: "prof:mysticAura" },
      ],
    },
    SITUATIONAL_PROFICIENCIES,
  ],
  [INFLUENCE_TONE.SEDUCTION]: [
    {
      group: "Age",
      mods: [
        { key: "age", type: "signed", label: "Age category modifier (±1 per category vs. target's preference)" },
      ],
    },
    {
      group: "Status",
      mods: [
        { key: "socialStatus", type: "factor", factor: 1, label: "Higher social status (+1 per noble rank)" },
        { key: "higherLevel", type: "check", label: "Significantly higher level, 3+ levels (+1)", value: 1 },
        { key: "lowerLevel", type: "check", label: "Significantly lower level, 3+ levels (-1)", value: -1 },
      ],
    },
    {
      group: "Appeal",
      mods: [
        { key: "appealing", type: "signed", label: "Appearance/behavior appealing to target (+1 or more)" },
        { key: "unappealing", type: "signed", label: "Appearance/behavior unappealing to target (-1 or more)" },
      ],
    },
    {
      group: "Privacy",
      mods: [
        { key: "alone", type: "check", label: "Character and target are alone (+1)", value: 1 },
        { key: "inFrontOfFriends", type: "check", label: "In front of target's friends (-1)", value: -1 },
      ],
    },
    {
      group: "Attributes & Proficiencies",
      mods: [
        { key: "charisma", type: "signed", label: "Charisma modifier", auto: "cha" },
        { key: "mysticAura", type: "check", label: "Mystic Aura proficiency (+1)", value: 1, auto: "prof:mysticAura" },
        { key: "seductionProf", type: "check", label: "Seduction proficiency (+1)", value: 1, auto: "prof:seduction" },
        { key: "performanceArt", type: "check", label: "Also demonstrates Performance or Art (+1)", value: 1, auto: "prof:performanceArt" },
        { key: "targetWill", type: "factor", factor: -1, label: "Target's Will modifier (-Mod)", auto: "targetWill" },
      ],
    },
    {
      group: "Relationship History",
      mods: [
        { key: "tookAdvantageFriends", type: "check", label: "Took advantage of target's friends in the past (-1)", value: -1 },
        { key: "tookAdvantageTarget", type: "check", label: "Took advantage of target in the past (-2)", value: -2 },
        { key: "personalRisk", type: "signed", label: "Target at personal risk from liaison (-2 or more)" },
      ],
    },
    SITUATIONAL_PROFICIENCIES,
  ],
});
