// src/module.ts
import { launchNpcGenerator } from "./ai-npc-generator/index.js";
Hooks.once("init", () => {
    game.settings.register("pf2e-ai-npc-generator", "apiKey", {
        name: "DeepSeek API Key",
        hint: "Your DeepSeek API key (sk-...). Stored on this client only.",
        scope: "client",
        config: true,
        type: String,
        default: "",
    });
    game.settings.register("pf2e-ai-npc-generator", "lastPrompt", {
        name: "Last NPC Prompt",
        scope: "client",
        config: false,
        type: String,
        default: "",
    });
    game.settings.register("pf2e-ai-npc-generator", "lastLevel", {
        name: "Last NPC Level",
        scope: "client",
        config: false,
        type: Number,
        default: 1,
    });
});
Hooks.on("renderActorDirectoryPF2e", (app, html) => {
    if (!game.user.isGM)
        return;
    // Resolve a root element/jQuery we can search within
    let $root = null;
    if (app?.element) {
        $root = app.element instanceof HTMLElement ? $(app.element) : $(app.element);
    }
    else if (html) {
        $root = (html.find && typeof html.find === "function") ? html : $(html);
    }
    if (!$root)
        return;
    const $footer = $root.find("footer.directory-footer");
    if (!$footer.length)
        return;
    // Avoid adding the button multiple times
    if ($footer.find("button[data-action='ai-generate-npc']").length)
        return;
    const label = game.i18n?.localize?.("PF2E.Actor.AiNpcGenerator.Title") || "Generate NPC";
    const btn = $(`
    <button type="button" data-action="ai-generate-npc">
      <i class="fa-solid fa-dice-d20"></i> ${label}
    </button>
  `);
    btn.on("click", () => launchNpcGenerator());
    $footer.append(btn);
});
globalThis.pf2eAiNpcGenerator = {
    launch: () => launchNpcGenerator(),
};
