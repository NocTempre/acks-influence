/* global foundry, game, ChatMessage, CONST, Roll, fromUuid, ui */
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
import {
  autoKeysByTone,
  computeDefaults,
  getActorHD,
  getEffectReactionMods,
  getProficiencies,
  getTargetActor,
  monthlyWageForHD,
  resolveParties,
} from "./actor-data.mjs";

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
  /** Actor-specific modifier config: static groups + an effect-granted group. */
  #modConfig = null;
  /** Sum of relationship + tone modifiers (before the GM adjustment bucket). */
  #subtotal = 0;
  /** Effective modifier applied to the roll (#subtotal + GM adjustment). */
  #finalModifier = 0;

  constructor(options = {}) {
    super(options);

    this.#actor = options.actor ?? null;
    this.#targetActor = options.targetActor ?? getTargetActor();
    // Don't auto-fill the target with the influencer themselves (e.g. a
    // self-targeted token) — keep the two sides distinct until set explicitly.
    if (this.#targetActor && this.#targetActor === this.#actor) this.#targetActor = null;

    this.#modConfig = this.#buildModConfig();
    this.#defaults = computeDefaults(this.#actor, this.#targetActor, this.#modConfig);
    this.#modifiers = foundry.utils.deepClone(this.#defaults);

    this.#system = {
      tone: INFLUENCE_TONE.DIPLOMACY,
      mode: INFLUENCE_MODE.INITIAL,
      attempt: 1,
      currentAttitude: 2, // Neutral
      gmAdjustment: 0, // generic GM catch-all bucket
      bribeFeeOverridden: false, // true once the GM edits the bribe fee by hand
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
  /*  Modifier configuration                      */
  /* -------------------------------------------- */

  /**
   * The per-tone modifier config for the current actor: the static screen layout
   * plus a "Proficiencies & Powers" group synthesised from the actor's active
   * effects (see getEffectReactionMods). Effect-granted modifiers render as
   * checkboxes — default on when non-situational, off when the GM must confirm.
   */
  #buildModConfig() {
    const effectMods = getEffectReactionMods(this.#actor);
    const config = {};
    for (const tone of Object.values(INFLUENCE_TONE)) {
      const groups = INFLUENCE_MODIFIERS[tone].map((g) => ({ group: g.group, mods: g.mods }));
      const forTone = effectMods.filter((m) => m.tone === "all" || m.tone === tone);
      if (forTone.length) {
        groups.push({
          group: "ACKS-INFLUENCE.group.powers",
          mods: forTone.map((m) => ({
            key: m.id,
            type: "check",
            label: m.label,
            value: m.value,
            default: !m.situational,
            fromEffect: true,
          })),
        });
      }
      config[tone] = groups;
    }
    return config;
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
      case "gold": // a gp amount (e.g. the bribe fee) — never modifies the roll
      default:
        return 0;
    }
  }

  /* -------------------------------------------- */
  /*  Bribe fee                                   */
  /* -------------------------------------------- */

  /**
   * Auto-computed bribe fee (gp) from the target's HD and the chosen bribe bonus:
   * +1/+2/+3 = a day / week / month of pay (a week / month / year without the
   * Bribery proficiency), where "a month" is the henchman wage for the target's HD.
   */
  #computeBribeFee() {
    const diplo = this.#modifiers[INFLUENCE_TONE.DIPLOMACY];
    const level = Number(diplo.bribe) || 0;
    if (level <= 0) return 0;
    const monthly = monthlyWageForHD(getActorHD(this.#targetActor));
    const day = Math.round(monthly / 30);
    const week = Math.round(monthly / 4);
    const year = monthly * 12;
    const hasBribery = getProficiencies(this.#actor).bribery;
    const units = hasBribery ? { 1: day, 2: week, 3: monthly } : { 1: week, 2: monthly, 3: year };
    return units[level] ?? 0;
  }

  /** Refresh the auto bribe fee unless the GM has overridden it. */
  #syncBribeFee() {
    if (this.#system.bribeFeeOverridden) return;
    this.#modifiers[INFLUENCE_TONE.DIPLOMACY].bribeFee = this.#computeBribeFee();
  }

  #relationshipModifier() {
    return INFLUENCE_RELATIONSHIP_MOD[this.#system.currentAttitude] ?? 0;
  }

  #computeSubtotal() {
    const values = this.#modifiers[this.#system.tone];
    let total = this.#relationshipModifier();
    for (const group of this.#modConfig[this.#system.tone]) {
      for (const mod of group.mods) {
        total += this.#contribution(mod, values[mod.key]);
      }
    }
    return total;
  }

  #recalculate() {
    this.#syncBribeFee();
    this.#subtotal = this.#computeSubtotal();
    this.#finalModifier = this.#subtotal + (Number(this.#system.gmAdjustment) || 0);
  }

  /** Non-zero contributions (for the chat card), including relationship & GM bucket. */
  #activeModifiers() {
    const list = [];
    const rel = this.#relationshipModifier();
    if (rel !== 0) {
      const attitude = game.i18n.localize(
        INFLUENCE_ATTITUDE_LABELS[this.#system.tone][this.#system.currentAttitude],
      );
      list.push({ label: game.i18n.format("ACKS-INFLUENCE.summary.relationship", { attitude }), value: rel });
    }
    const values = this.#modifiers[this.#system.tone];
    for (const group of this.#modConfig[this.#system.tone]) {
      for (const mod of group.mods) {
        const contribution = this.#contribution(mod, values[mod.key]);
        // Effect-granted labels are literal; static labels are localization keys.
        if (contribution !== 0) list.push({ label: game.i18n.localize(mod.label), value: contribution });
      }
    }
    const gm = Number(this.#system.gmAdjustment) || 0;
    if (gm !== 0) list.push({ label: game.i18n.localize("ACKS-INFLUENCE.summary.gmAdjustment"), value: gm });
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
      label: game.i18n.localize(label),
      modifier: INFLUENCE_RELATIONSHIP_MOD[index],
      isActive: index === this.#system.currentAttitude,
    }));
  }

  #buildGroups() {
    const tone = this.#system.tone;
    const values = this.#modifiers[tone];
    const defaults = this.#defaults[tone];
    const autoKeys = this.#autoKeys[tone];
    const L = (s) => game.i18n.localize(s);
    return this.#modConfig[tone].map((group) => ({
      group: L(group.group),
      mods: group.mods.map((mod) => {
        const value = values[mod.key];
        const isAuto = autoKeys.has(mod.key);
        const isGold = mod.type === "gold";
        return {
          key: mod.key,
          // Effect-granted labels are literal text; localize() passes them through.
          label: L(mod.label),
          isCheck: mod.type === "check",
          isSelect: mod.type === "select",
          isNumber: mod.type === "signed" || mod.type === "factor",
          isGold,
          isEffect: Boolean(mod.fromEffect),
          value,
          checked: mod.type === "check" ? Boolean(value) : false,
          options:
            mod.type === "select"
              ? mod.options.map((opt) => ({ value: opt.value, label: L(opt.label), selected: Number(opt.value) === Number(value) }))
              : null,
          contribution: this.#contribution(mod, value),
          isAuto,
          isOverridden: isGold
            ? this.#system.bribeFeeOverridden
            : isAuto && String(value) !== String(defaults[mod.key]),
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

    context.parties = resolveParties(this.#actor, this.#targetActor);
    context.hasTarget = Boolean(this.#targetActor);
    context.ladder = this.#attitudeLadder();
    context.groups = this.#buildGroups();
    context.relationshipModifier = this.#relationshipModifier();
    context.finalModifier = this.#finalModifier;

    const timeStep = INFLUENCE_TIME_STEPS.find((step) => step.value === this.#system.attempt);
    context.timeLabel = timeStep ? game.i18n.localize(timeStep.label) : "";

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

    // A hand-edited bribe fee (vs. the rendered auto value) latches an override.
    const renderedBribeFee = Number(this.#modifiers[INFLUENCE_TONE.DIPLOMACY].bribeFee) || 0;
    if (data.mod?.bribeFee !== undefined && Number(data.mod.bribeFee) !== renderedBribeFee) {
      this.#system.bribeFeeOverridden = true;
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
    this.#modConfig = this.#buildModConfig();
    this.#defaults = computeDefaults(this.#actor, this.#targetActor, this.#modConfig);
    const tone = this.#system.tone;
    this.#modifiers[tone] = foundry.utils.deepClone(this.#defaults[tone]);
    this.#system.gmAdjustment = 0; // clear the GM bucket / total override
    this.#system.bribeFeeOverridden = false; // re-detect the bribe fee
    this.#recalculate();
    this.render();
  }

  /* -------------------------------------------- */
  /*  Drag & drop of actors/tokens onto a side    */
  /* -------------------------------------------- */

  /** @override */
  _onRender(context, options) {
    super._onRender?.(context, options);
    for (const el of this.element.querySelectorAll(".influence-party[data-side]")) {
      el.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        el.classList.add("drop-hover");
      });
      el.addEventListener("dragleave", () => el.classList.remove("drop-hover"));
      el.addEventListener("drop", (ev) => this.#onDropActor(ev, el.dataset.side));
    }
  }

  async #onDropActor(event, side) {
    event.preventDefault();
    event.currentTarget?.classList?.remove("drop-hover");
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch {
      return;
    }
    let actor = null;
    if (data?.type === "Actor") actor = (await fromUuid(data.uuid)) ?? game.actors.get(data.id);
    else if (data?.type === "Token") actor = (await fromUuid(data.uuid))?.actor ?? null;
    if (!actor) return;

    if (side === "target") this.#targetActor = actor;
    else this.#actor = actor;
    this.#refreshFromActors();
    this.render();
  }

  /** Rebuild config + re-apply auto/effect values for the current actors, keeping manual edits. */
  #refreshFromActors() {
    this.#modConfig = this.#buildModConfig();
    const newDefaults = computeDefaults(this.#actor, this.#targetActor, this.#modConfig);
    for (const tone of Object.keys(newDefaults)) {
      const merged = { ...this.#modifiers[tone] };
      for (const group of this.#modConfig[tone]) {
        for (const mod of group.mods) {
          // Refresh auto-detected and effect-granted values; add any new keys.
          if ((mod.auto && mod.auto !== "bribeFee") || mod.fromEffect || !(mod.key in merged)) {
            merged[mod.key] = newDefaults[tone][mod.key];
          }
        }
      }
      this.#modifiers[tone] = merged;
    }
    this.#defaults = newDefaults;
    this.#system.bribeFeeOverridden = false; // re-detect fee for the new target
    this.#recalculate();
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
    const label = game.i18n.localize(INFLUENCE_ATTITUDE_LABELS[this.#system.tone][ATTITUDE_COUNT - 1]);
    switch (band.key) {
      case "2-":
        return game.i18n.localize("ACKS-INFLUENCE.shift.hostile2");
      case "3-5":
        return game.i18n.localize("ACKS-INFLUENCE.shift.hostile1");
      case "6-8":
        return game.i18n.localize("ACKS-INFLUENCE.shift.neutral1");
      case "9-11":
        return game.i18n.format("ACKS-INFLUENCE.shift.top1", { label });
      case "12+":
        return game.i18n.format("ACKS-INFLUENCE.shift.top2", { label });
      default:
        return "";
    }
  }

  /* -------------------------------------------- */
  /*  Bribe gold movement                         */
  /* -------------------------------------------- */

  async #maybePayBribe() {
    if (this.#system.tone !== INFLUENCE_TONE.DIPLOMACY) return null;
    const diplo = this.#modifiers[INFLUENCE_TONE.DIPLOMACY];
    const level = Number(diplo.bribe) || 0;
    const fee = Number(diplo.bribeFee) || 0;
    if (level <= 0 || fee <= 0) return null;
    return this.#moveBribeGold(fee);
  }

  async #moveBribeGold(fee) {
    const from = this.#actor;
    const to = this.#targetActor;
    let deducted = false;
    let credited = false;
    try {
      if (from?.isOwner) deducted = await this.#adjustGold(from, -fee);
      if (to && to !== from && to.isOwner) credited = await this.#adjustGold(to, fee);
    } catch (err) {
      console.error(`${MODULE_ID} | bribe gold move failed`, err);
    }
    if (from && !deducted) {
      ui.notifications?.warn(game.i18n.format("ACKS-INFLUENCE.bribe.noGold", { name: from.name }));
    }
    return { fee, from: deducted ? from?.name ?? null : null, to: credited ? to?.name ?? null : null };
  }

  /** Adjust an actor's Gold money item by `delta` gp (creating it on credit). */
  async #adjustGold(actor, delta) {
    const gold = actor.items.find((i) => i.type === "money" && /gold/i.test(i.name));
    if (!gold) {
      if (delta > 0) {
        await actor.createEmbeddedDocuments("Item", [
          { name: "Gold", type: "money", system: { quantity: delta } },
        ]);
        return true;
      }
      return false;
    }
    const current = Number(gold.system?.quantity) || 0;
    await gold.update({ "system.quantity": Math.max(0, current + delta) });
    return true;
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

    // If a bribe was offered with a fee, move the gold now.
    const bribePaid = await this.#maybePayBribe();

    const result = {
      toneLabel,
      bribePaid,
      influencerName: this.#actor?.name ?? game.i18n.localize("ACKS-INFLUENCE.party.influencer"),
      targetName: this.#targetActor?.name ?? game.i18n.localize("ACKS-INFLUENCE.party.target"),
      isContinuing,
      rollFormula: `2d6 + (${modifier})`,
      diceResult,
      modifier,
      total,
      activeModifiers,
      bandLabel: game.i18n.localize(INFLUENCE_BAND_LABELS[tone][band.key]),
      startAttitude: game.i18n.localize(labels[startIndex]),
      resultAttitude: game.i18n.localize(labels[newIndex]),
      shiftDescription: isContinuing ? this.#shiftDescription(band) : null,
      // Mystic Aura kicker: a +1 that brings the total to 12+ bewitches the subject.
      bewitched: mysticAuraActive && total >= 12,
      attempt: this.#system.attempt,
      timeLabel: isContinuing && timeStep ? game.i18n.localize(timeStep.label) : null,
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
