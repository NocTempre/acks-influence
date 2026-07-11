/**
 * Static rules data for the ACKS II influence rolls.
 * Sourced from the player rules (pp. 84-87) and the Judges Journal GM screen.
 * The modifier layout mirrors the GM screen: rows in screen order, grouped by
 * the Both / Either / Character / Target keys, with "±" rows as selects.
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
 * Henchman Monthly Wage by class level (index = level 0-14), in gp. Used to
 * auto-populate the bribe fee from the target's HD/level.
 */
export const HENCHMAN_MONTHLY_WAGE = Object.freeze([
  12, 25, 50, 100, 200, 400, 800, 1600, 3000, 7250, 12000, 32000, 50000, 135000, 350000,
]);

/**
 * Modifier field types:
 * - `check`  : boolean; contributes `value` when checked, else 0.
 * - `select` : mutually-exclusive options; contributes the chosen value.
 * - `signed` : free number input; contributes the value as typed (may be negative).
 * - `factor` : magnitude input; contributes `factor * value`.
 * - `gold`   : a gp amount that does NOT modify the roll (e.g. the bribe fee).
 *
 * `auto` pre-fills a field from the actor/target. Sources resolved in
 * actor-data.mjs: "cha", "targetWill", "alignment", "prof:<name>", "bribeFee".
 * `requiresProf` shows the field only when the actor has that proficiency.
 */

/**
 * Situational reaction bonuses from proficiencies that depend on *what the
 * target is* (a normal animal, a townsfolk, ...). Shared by all three tones and
 * shown only when the actor has the proficiency. See reference §5.3.
 */
const SITUATIONAL_PROFICIENCIES = {
  group: "Situational Proficiencies",
  mods: [
    { key: "beastFriendship", type: "check", label: "Beast Friendship — target is a normal animal (+2)", value: 2, requiresProf: "beastFriendship" },
    { key: "animalTrainer", type: "check", label: "Animal Husbandry — tame, uncontrolled animal (+1)", value: 1, requiresProf: "animalHusbandry" },
    { key: "folkways", type: "check", label: "Folkways — 0th-level target in home settlement (+1)", value: 1, requiresProf: "folkways" },
  ],
};

const LAIR_OPTIONS = [
  { label: "—", value: 0 },
  { label: "Character in own lair (+1)", value: 1 },
  { label: "Trespassing in target's lair (-1)", value: -1 },
];

export const INFLUENCE_MODIFIERS = Object.freeze({
  [INFLUENCE_TONE.DIPLOMACY]: [
    {
      group: "Both",
      mods: [
        {
          key: "alignment",
          type: "select",
          label: "Alignment match / mismatch",
          auto: "alignment",
          options: [
            { label: "—", value: 0 },
            { label: "Match: Lawful vs Lawful/Neutral (+1)", value: 1 },
            { label: "Mismatch (-1)", value: -1 },
          ],
        },
        { key: "lair", type: "select", label: "In own lair", options: LAIR_OPTIONS },
      ],
    },
    {
      group: "Either",
      mods: [
        { key: "authority", type: "signed", label: "Has authority over the other (±1 or more)" },
        { key: "favors", type: "signed", label: "Owes favors (±1 per unrequited favor)" },
        { key: "charisma", type: "signed", label: "CHA modifier", auto: "cha" },
        {
          key: "bribe",
          type: "select",
          label: "Offering bribe",
          options: [
            { label: "—", value: 0 },
            { label: "+1", value: 1 },
            { label: "+2", value: 2 },
            { label: "+3", value: 3 },
          ],
        },
        { key: "bribeFee", type: "gold", label: "Bribe fee (gp)", auto: "bribeFee" },
      ],
    },
    {
      group: "Character",
      mods: [
        { key: "diplomacyProf", type: "check", label: "Diplomacy proficiency (+1)", value: 1, auto: "prof:diplomacy" },
        { key: "mysticAura", type: "check", label: "Mystic Aura proficiency (+1)", value: 1, auto: "prof:mysticAura" },
        { key: "brandishing", type: "check", label: "Brandishing a weapon (-1)", value: -1 },
        { key: "targetWill", type: "factor", factor: -1, label: "Target's WIL modifier (−/＋WIL)", auto: "targetWill" },
        { key: "believesHarmed", type: "check", label: "Target thinks character harmed friends (-1)", value: -1 },
        { key: "evidenceHarmed", type: "check", label: "Target knows character harmed friends (-2)", value: -2 },
        { key: "personallyHarmed", type: "check", label: "Harmed by character (-5)", value: -5 },
      ],
    },
    SITUATIONAL_PROFICIENCIES,
  ],
  [INFLUENCE_TONE.INTIMIDATION]: [
    {
      group: "Both",
      mods: [
        {
          key: "outnumber",
          type: "select",
          label: "Outnumbering",
          options: [
            { label: "—", value: 0 },
            { label: "You outnumber (+1)", value: 1 },
            { label: "You outnumber 3:2 (+2)", value: 2 },
            { label: "You outnumber 3:1 (+5)", value: 5 },
            { label: "Target outnumbers (-1)", value: -1 },
            { label: "Target outnumbers 3:2 (-2)", value: -2 },
            { label: "Target outnumbers 3:1 (-5)", value: -5 },
          ],
        },
        { key: "lair", type: "select", label: "In own lair", options: LAIR_OPTIONS },
      ],
    },
    {
      group: "Either",
      mods: [
        {
          key: "brandishing",
          type: "select",
          label: "Weapons",
          options: [
            { label: "—", value: 0 },
            { label: "Character brandishing (+1)", value: 1 },
            { label: "Target armed (-1)", value: -1 },
          ],
        },
        {
          key: "magicItems",
          type: "select",
          label: "Magic items",
          options: [
            { label: "—", value: 0 },
            { label: "Character has magic items (+1)", value: 1 },
            { label: "Target has magic items (-1)", value: -1 },
          ],
        },
        { key: "advantage", type: "signed", label: "Has the other at a disadvantage (±1 or more)" },
        { key: "authority", type: "signed", label: "Has legal authority over the other (±1 or more)" },
        { key: "levelGap", type: "signed", label: "3+ HD higher level than the other (±1 or more)" },
      ],
    },
    {
      group: "Character",
      mods: [
        { key: "charisma", type: "signed", label: "CHA modifier", auto: "cha" },
        { key: "intimidationProf", type: "check", label: "Intimidation proficiency (+1; target <5 HD or you outnumber/outrank)", value: 1, auto: "prof:intimidation" },
        { key: "mysticAura", type: "check", label: "Mystic Aura proficiency (+1)", value: 1, auto: "prof:mysticAura" },
      ],
    },
    {
      group: "Target",
      mods: [
        { key: "targetMorale", type: "factor", factor: -1, label: "Target's Morale score (−/＋Morale)" },
        { key: "targetWill", type: "factor", factor: -1, label: "Target's WIL modifier (−/＋WIL)", auto: "targetWill" },
        { key: "sawFriendsHurt", type: "check", label: "Target saw character kill/torture associates (+1)", value: 1 },
        { key: "lossOfFace", type: "signed", label: "Target fears loss of face if it submits (−1 or more)" },
        { key: "fearsBoss", type: "signed", label: "Target fears its master more (−5 or more)" },
      ],
    },
    SITUATIONAL_PROFICIENCIES,
  ],
  [INFLUENCE_TONE.SEDUCTION]: [
    {
      group: "Both",
      mods: [
        { key: "alone", type: "check", label: "Alone together (+1)", value: 1 },
        { key: "friendsPresent", type: "check", label: "In front of the target's friends (-1)", value: -1 },
      ],
    },
    {
      group: "Either",
      mods: [
        {
          key: "levelGap",
          type: "select",
          label: "3+ levels higher / lower",
          options: [
            { label: "—", value: 0 },
            { label: "Character higher (+1)", value: 1 },
            { label: "Character lower (-1)", value: -1 },
          ],
        },
        { key: "age", type: "signed", label: "Attractive/unattractive age vs. target's preference (±1 per category)" },
        { key: "appeal", type: "signed", label: "Appealing/unappealing behavior or appearance (±1 or more)" },
      ],
    },
    {
      group: "Character",
      mods: [
        { key: "socialStatus", type: "factor", factor: 1, label: "Higher social status (+1 per noble rank)" },
        { key: "charisma", type: "signed", label: "CHA modifier", auto: "cha" },
        { key: "seductionProf", type: "check", label: "Seduction proficiency (+1)", value: 1, auto: "prof:seduction" },
        { key: "mysticAura", type: "check", label: "Mystic Aura proficiency (+1)", value: 1, auto: "prof:mysticAura" },
        { key: "performanceArt", type: "check", label: "Also demonstrates Performance or Art (+1)", value: 1, auto: "prof:performanceArt" },
        { key: "targetWill", type: "factor", factor: -1, label: "Target's WIL modifier (−/＋WIL)", auto: "targetWill" },
      ],
    },
    {
      group: "Target",
      mods: [
        { key: "tookAdvantageFriends", type: "check", label: "Took advantage of target's friends in the past (-1)", value: -1 },
        { key: "tookAdvantageTarget", type: "check", label: "Took advantage of target in the past (-2)", value: -2 },
        { key: "personalRisk", type: "signed", label: "Liaison would put target at personal risk (−2 or more)" },
      ],
    },
    SITUATIONAL_PROFICIENCIES,
  ],
});
