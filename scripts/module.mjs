/* global Hooks, game, foundry, canvas */
import InfluenceApp from "./influence-app.mjs";
import { MODULE_ID } from "./constants.mjs";

/** Open the influence roller for a given actor (or standalone if none). */
function openInfluenceApp(actor = null) {
  return new InfluenceApp({ actor }).render(true);
}

Hooks.once("init", () => {
  // Public API for macros / other modules. Set this FIRST so nothing below can
  // prevent it from being assigned.
  const api = { open: openInfluenceApp, InfluenceApp };
  const module = game.modules.get(MODULE_ID);
  if (module) module.api = api;
  // Also expose globally as a resilient fallback for macros.
  globalThis.acksInfluence = api;

  // Preload templates so first render and chat cards are instant (best-effort).
  try {
    foundry.applications.handlebars.loadTemplates([
      `modules/${MODULE_ID}/templates/influence.hbs`,
      `modules/${MODULE_ID}/templates/influence-result.hbs`,
    ]);
  } catch (err) {
    console.warn(`${MODULE_ID} | template preload skipped`, err);
  }
});

Hooks.once("ready", () => {
  if (game.system?.id !== "acks") {
    console.warn(`${MODULE_ID} | Active system is not "acks"; the character-sheet button may not appear.`);
  }
});

/**
 * Inject an "Influence" button into the ACKS character sheet header, styled to
 * match the system's existing header icon buttons. Fails gracefully if the
 * header structure changes.
 * @param {foundry.applications.api.ApplicationV2} app
 * @param {HTMLElement|JQuery} element
 */
function injectSheetButton(app, element) {
  try {
    const actor = app?.actor ?? app?.document ?? null;
    if (actor?.type !== "character") return;

    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root || root.querySelector(".acks-influence-btn")) return;

    const anchor = root.querySelector(".sheet-header .health-box") ?? root.querySelector(".sheet-header");
    if (!anchor) return;

    const wrap = document.createElement("div");
    wrap.className = "form-icon-btn";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "plain icon fa-regular fa-comments acks-influence-btn";
    btn.dataset.tooltip = game.i18n.localize("ACKS-INFLUENCE.button.tooltip");
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openInfluenceApp(actor);
    });
    wrap.appendChild(btn);

    if (anchor.classList.contains("health-box")) anchor.insertAdjacentElement("afterend", wrap);
    else anchor.appendChild(wrap);
  } catch (err) {
    console.error(`${MODULE_ID} | failed to inject sheet button`, err);
  }
}

// v13/v14 ApplicationV2 fires render hooks for the whole class inheritance chain.
// We anchor on the base-class hooks (which fire regardless of the system sheet's
// possibly-minified class name) plus the system-specific name. injectSheetButton
// filters to character sheets and dedupes, so multiple firings are harmless.
Hooks.on("renderApplicationV2", injectSheetButton);
Hooks.on("renderActorSheetV2", injectSheetButton);
Hooks.on("renderACKSCharacterSheetV2", injectSheetButton);

/**
 * Support the `/influence` chat command. Returning false prevents the message
 * from being created as normal chat.
 */
Hooks.on("chatMessage", (_chatLog, message) => {
  const command = message.trim().toLowerCase();
  if (command !== "/influence" && command !== "/inf") return true;

  // Prefer a controlled token's actor, then the user's assigned character.
  const controlled = canvas?.tokens?.controlled?.[0]?.actor ?? null;
  const actor = controlled ?? game.user?.character ?? null;
  openInfluenceApp(actor);
  return false;
});
