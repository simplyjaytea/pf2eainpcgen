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
    const tryAdd = () => {
        // Support both raw HTMLElement and jQuery passed by the hook
        let root = app?.element ?? html;
        if (!root)
            return;
        const $root = root instanceof HTMLElement ? $(root) : $(root);
        if (!$root || !$root.length)
            return;
        let $footer = $root.find("footer.directory-footer");
        if (!$footer.length)
            $footer = $root.find("footer");
        if (!$footer.length) {
            // Footer might not be in the DOM yet on first render pass
            setTimeout(tryAdd, 120);
            return;
        }
        if ($footer.find("[data-action='ai-generate-npc']").length)
            return;
        const label = game.i18n?.localize?.("PF2E.Actor.AiNpcGenerator.Generate") || "Generate NPC";
        const $btn = $(`
      <button type="button" data-action="ai-generate-npc">
        <i class="fa-solid fa-dice-d20"></i> ${label}
      </button>
    `);
        $btn.on("click", (ev) => {
            ev.preventDefault();
            try {
                launchNpcGenerator();
            }
            catch (e) {
                console.error(e);
                ui.notifications?.error?.("Failed to open PF2e AI NPC Generator");
            }
        });
        $footer.append($btn);
    };
    tryAdd();
});
globalThis.pf2eAiNpcGenerator = {
    launch: () => launchNpcGenerator(),
};
