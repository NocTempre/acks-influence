/* global foundry, game, ChatMessage, CONST, Roll */
import {
  INFLUENCE_ATTITUDE_LABELS,
  INFLUENCE_BAND_LABELS,
  INFLUENCE_BANDS,
  INFLUENCE_MODE,
  INFLUENCE_MODE_CHOICES,
  INFLUENCE_MODIFIERS,
  INFLUENCE_RELATIONSHIP_MOD,
  INFLUENCE_TIME_STEPS,
  INFLUENCE_TONE,
  INFLUENCE_TONE_CHOICES,
  MODULE_ID,
} from "./constants.mjs";
import { autoKeysByTone, computeDefaults, getProficiencies, getTargetActor, resolveParties } from "./actor-data.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const ATTITUDE_COUNT = INFLUENCE_RELATIONSHIP_MOD.length; // 5 rungs

/**
 * Resolves the three kinds of ACKS II influence rolls (Diplomacy, Intimidation,
 * Seduction). Builds the tone-specific set of modifiers, auto-populates values
 * from the actor and targeted token, rolls 2d6 + modifiers against the reaction
 * table, and either establishes an initial reaction or shifts a current attitude.
 */
export default class InfluenceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  #actor = null;
  #targetActor = null;
  #system = null;
  /** Current per-tone modifier values (may be user-overridden). */
  #modifiers = null;
  /** Detected per-tone default values, used by "reset to defaults". */
  #defaults = null;
  #autoKeys = autoKeysByTone();
  /** Reaction-relevant proficiencies the actor possesses (gates situational mods). */
  #profs = {};
  /** Sum of relationship + tone modifiers (before the GM adjustment bucket). */
  #subtotal = 0;
  /** Effective modifier applied to the roll (#subtotal + GM adjustment). */
  #finalModifier = 0;

  constructor(options = {}) {
    super(options);

    this.#actor = options.actor ?? null;
    this.#targetActor = options.targetActor ?? getTargetActor();

    this.#profs = getProficiencies(this.#actor);
    this.#defaults = computeDefaults(this.#actor, this.#targetActor);
    this.#modifiers = foundry.utils.deepClone(this.#defaults);

    this.#system = {
      tone: INFLUENCE_TONE.DIPLOMACY,
      mode: INFLUENCE_MODE.INITIAL,
      attempt: 1,
      currentAttitude: 2, // Neutral
      gmAdjustment: 0, // generic GM catch-all bucket
    };

    this.#recalculate();
  }

  static DEFAULT_OPTIONS = {
    classes: ["acks-influence", "influence-dialog"],
    sheetConfig: false,
    window: { resizable: true, title: "ACKS-INFLUENCE.app.title" },
    position: { width: 740, height: "auto" },
    tag: "form",
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
      handler: InfluenceApp.#onChangeForm,
    },
    actions: {
      roll: InfluenceApp.#onRoll,
      setAttitude: InfluenceApp.#onSetAttitude,
      resetDefaults: InfluenceApp.#onResetDefaults,
    },
    actor: null,
  };

  static PARTS = {
    app: { template: `modules/${MODULE_ID}/templates/influence.hbs` },
  };

  /** @override */
  get title() {
    const base = game.i18n.localize("ACKS-INFLUENCE.app.title");
    return this.#actor ? `${this.#actor.name}: ${base}` : base;
  }

  /* -------------------------------------------- */
  /*  Modifier maths                              */
  /* -------------------------------------------- */

  #contribution(mod, value) {
    switch (mod.type) {
      case "check":
        return value ? mod.value : 0;
      case "select":
      case "signed":
        return Number(value) || 0;
      case "factor":
        return mod.factor * (Number(value) || 0);
      default:
        return 0;
    }
  }

  #relationshipModifier() {
    return INFLUENCE_RELATIONSHIP_MOD[this.#system.currentAttitude] ?? 0;
  }

  #computeSubtotal() {
    const values = this.#modifiers[this.#system.tone];
    let total = this.#relationshipModifier();
    for (const group of INFLUENCE_MODIFIERS[this.#system.tone]) {
      for (const mod of group.mods) {
        total += this.#contribution(mod, values[mod.key]);
      }
    }
    return total;
  }

  #recalculate() {
    this.#subtotal = this.#computeSubtotal();
    this.#finalModifier = this.#subtotal + (Number(this.#system.gmAdjustment) || 0);
  }

  /** Non-zero contributions (for the chat card), including relationship & GM bucket. */
  #activeModifiers() {
    const list = [];
    const rel = this.#relationshipModifier();
    if (rel !== 0) {
      const attitude = INFLUENCE_ATTITUDE_LABELS[this.#system.tone][this.#system.currentAttitude];
      list.push({ label: `Current attitude (${attitude})`, value: rel });
    }
    const values = this.#modifiers[this.#system.tone];
    for (const group of INFLUENCE_MODIFIERS[this.#system.tone]) {
      for (const mod of group.mods) {
        const contribution = this.#contribution(mod, values[mod.key]);
        if (contribution !== 0) list.push({ label: mod.label, value: contribution });
      }
    }
    const gm = Number(this.#system.gmAdjustment) || 0;
    if (gm !== 0) list.push({ label: "GM adjustment", value: gm });
    return list;
  }

  /** Is Mystic Aura an active contributor for the current tone? */
  #mysticAuraActive() {
    return Boolean(this.#modifiers[this.#system.tone]?.mysticAura);
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  #attitudeLadder() {
    const labels = INFLUENCE_ATTITUDE_LABELS[this.#system.tone];
    return labels.map((label, index) => ({
      index,
      label,
      modifier: INFLUENCE_RELATIONSHIP_MOD[index],
      isActive: index === this.#system.currentAttitude,
    }));
  }

  #buildGroups() {
    const tone = this.#system.tone;
    const values = this.#modifiers[tone];
    const defaults = this.#defaults[tone];
    const autoKeys = this.#autoKeys[tone];
    // A situational modifier is only offered if the actor has the proficiency.
    const visibleMods = (mods) => mods.filter((mod) => !mod.requiresProf || this.#profs[mod.requiresProf]);
    return INFLUENCE_MODIFIERS[tone]
      .map((group) => ({ group: group.group, mods: visibleMods(group.mods) }))
      .filter((group) => group.mods.length > 0)
      .map((group) => ({
        group: group.group,
        mods: group.mods.map((mod) => {
          const value = values[mod.key];
          const isAuto = autoKeys.has(mod.key);
          return {
            key: mod.key,
            label: mod.label,
            isCheck: mod.type === "check",
            isSelect: mod.type === "select",
            isNumber: mod.type === "signed" || mod.type === "factor",
            value,
            checked: mod.type === "check" ? Boolean(value) : false,
            options:
              mod.type === "select"
                ? mod.options.map((opt) => ({ ...opt, selected: Number(opt.value) === Number(value) }))
                : null,
            contribution: this.#contribution(mod, value),
            isAuto,
            isOverridden: isAuto && String(value) !== String(defaults[mod.key]),
          };
        }),
      }));
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    this.#recalculate();

    context.system = this.#system;
    context.isContinuing = this.#system.mode === INFLUENCE_MODE.CONTINUING;

    context.toneChoices = INFLUENCE_TONE_CHOICES;
    context.modeChoices = INFLUENCE_MODE_CHOICES;
    context.timeChoices = INFLUENCE_TIME_STEPS;
    context.attitudeChoices = INFLUENCE_ATTITUDE_LABELS[this.#system.tone].map((label, index) => ({
      value: index,
      label,
    }));

    context.parties = resolveParties(this.#actor, this.#targetActor);
    context.hasTarget = Boolean(this.#targetActor);
    context.ladder = this.#attitudeLadder();
    context.groups = this.#buildGroups();
    context.relationshipModifier = this.#relationshipModifier();
    context.subtotal = this.#subtotal;
    context.gmAdjustment = Number(this.#system.gmAdjustment) || 0;
    context.finalModifier = this.#finalModifier;

    const timeStep = INFLUENCE_TIME_STEPS.find((step) => step.value === this.#system.attempt);
    context.timeLabel = timeStep ? timeStep.label : "";

    return context;
  }

  /* -------------------------------------------- */
  /*  Event handlers                              */
  /* -------------------------------------------- */

  /**
   * @this {InfluenceApp}
   * @param {SubmitEvent} event
   * @param {HTMLFormElement} form
   * @param {FormDataExtended} formData
   */
  static async #onChangeForm(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);

    // Detect a GM-bucket / total override against the CURRENTLY RENDERED values,
    // before any modifier change shifts the subtotal. Only one field changes per
    // submit event, so a mismatch pinpoints which the user edited; editing the
    // total overrides it as a generic GM bucket (its delta from the subtotal).
    const renderedGm = Number(this.#system.gmAdjustment) || 0;
    const renderedTotal = this.#subtotal + renderedGm;
    let totalOverride = null;
    let gmOverride = null;
    if (data.finalTotal !== undefined && Number(data.finalTotal) !== renderedTotal) {
      totalOverride = Number(data.finalTotal);
    } else if (data.gmAdjustment !== undefined && Number(data.gmAdjustment) !== renderedGm) {
      gmOverride = Number(data.gmAdjustment) || 0;
    }

    // Persist the currently-displayed tone's modifier values before switching tone.
    const previousTone = this.#system.tone;
    if (data.mod) {
      this.#modifiers[previousTone] = foundry.utils.mergeObject(this.#modifiers[previousTone], data.mod, {
        inplace: false,
      });
    }

    if (data.tone) this.#system.tone = data.tone;
    if (data.mode) this.#system.mode = data.mode;
    if (data.attempt !== undefined) this.#system.attempt = Number(data.attempt);
    if (data.currentAttitude !== undefined) this.#system.currentAttitude = Number(data.currentAttitude);

    this.#subtotal = this.#computeSubtotal();
    if (totalOverride !== null) this.#system.gmAdjustment = totalOverride - this.#subtotal;
    else if (gmOverride !== null) this.#system.gmAdjustment = gmOverride;

    this.#recalculate();
    this.render();
  }

  /**
   * @this {InfluenceApp}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onSetAttitude(_event, target) {
    const index = Number(target.dataset.index);
    if (Number.isNaN(index) || index < 0 || index >= ATTITUDE_COUNT) return;
    this.#system.currentAttitude = index;
    this.#recalculate();
    this.render();
  }

  /**
   * Re-detect values from the actor/target and reset the current tone's fields.
   * @this {InfluenceApp}
   */
  static #onResetDefaults() {
    // Re-read the current target so a newly-selected token is picked up.
    this.#targetActor = getTargetActor() ?? this.#targetActor;
    this.#profs = getProficiencies(this.#actor);
    this.#defaults = computeDefaults(this.#actor, this.#targetActor);
    const tone = this.#system.tone;
    this.#modifiers[tone] = foundry.utils.deepClone(this.#defaults[tone]);
    this.#system.gmAdjustment = 0; // clear the GM bucket / total override
    this.#recalculate();
    this.render();
  }

  /**
   * @this {InfluenceApp}
   */
  static async #onRoll() {
    await this.#rollInfluence();
  }

  /* -------------------------------------------- */
  /*  Rolling                                     */
  /* -------------------------------------------- */

  #applyShift(baseIndex, band) {
    if (band.towardNeutral) {
      if (baseIndex < 2) return baseIndex + 1;
      if (baseIndex > 2) return baseIndex - 1;
      return 2;
    }
    return Math.min(ATTITUDE_COUNT - 1, Math.max(0, baseIndex + band.shift));
  }

  #shiftDescription(band) {
    const topLabel = INFLUENCE_ATTITUDE_LABELS[this.#system.tone][ATTITUDE_COUNT - 1];
    switch (band.key) {
      case "2-":
        return "Shift 2 attitudes toward Hostile";
      case "3-5":
        return "Shift 1 attitude toward Hostile";
      case "6-8":
        return "Shift 1 attitude toward Neutral";
      case "9-11":
        return `Shift 1 attitude toward ${topLabel}`;
      case "12+":
        return `Shift 2 attitudes toward ${topLabel}`;
      default:
        return "";
    }
  }

  async #rollInfluence() {
    this.#recalculate();

    // Capture the active modifiers before the roll (state is unchanged by rolling).
    const activeModifiers = this.#activeModifiers();
    const mysticAuraActive = this.#mysticAuraActive();

    const modifier = this.#finalModifier;
    const roll = new Roll(`2d6 + (${modifier})`);
    await roll.evaluate();

    const diceResult = roll.dice[0]?.total ?? roll.total - modifier;
    const total = roll.total;

    const band = INFLUENCE_BANDS.find((b) => total >= b.min && total <= b.max);

    const tone = this.#system.tone;
    const labels = INFLUENCE_ATTITUDE_LABELS[tone];
    const isContinuing = this.#system.mode === INFLUENCE_MODE.CONTINUING;

    const startIndex = this.#system.currentAttitude;
    const newIndex = isContinuing ? this.#applyShift(startIndex, band) : band.initialIndex;

    const toneLabel = game.i18n.localize(
      INFLUENCE_TONE_CHOICES.find((t) => t.value === tone)?.label ?? tone,
    );
    const timeStep = INFLUENCE_TIME_STEPS.find((step) => step.value === this.#system.attempt);

    const result = {
      toneLabel,
      influencerName: this.#actor?.name ?? game.i18n.localize("ACKS-INFLUENCE.party.influencer"),
      targetName: this.#targetActor?.name ?? game.i18n.localize("ACKS-INFLUENCE.party.target"),
      isContinuing,
      rollFormula: `2d6 + (${modifier})`,
      diceResult,
      modifier,
      total,
      activeModifiers,
      bandLabel: INFLUENCE_BAND_LABELS[tone][band.key],
      startAttitude: labels[startIndex],
      resultAttitude: labels[newIndex],
      shiftDescription: isContinuing ? this.#shiftDescription(band) : null,
      // Mystic Aura kicker: a +1 that brings the total to 12+ bewitches the subject.
      bewitched: mysticAuraActive && total >= 12,
      attempt: this.#system.attempt,
      timeLabel: isContinuing && timeStep ? timeStep.label : null,
    };

    const chatContent = await foundry.applications.handlebars.renderTemplate(
      `modules/${MODULE_ID}/templates/influence-result.hbs`,
      result,
    );

    const chatData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.#actor }),
      content: chatContent,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      rolls: [roll],
      flags: { [MODULE_ID]: { influence: true, rollResult: result } },
    };
    ChatMessage.create(chatData);

    // In continuing mode, advance the tracker and step the timer.
    if (isContinuing) {
      this.#system.currentAttitude = newIndex;
      this.#system.attempt = Math.min(INFLUENCE_TIME_STEPS.length, this.#system.attempt + 1);
      this.#recalculate();
      this.render();
    }
  }
}
