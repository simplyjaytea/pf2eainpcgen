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
        let root = null;
        if (app?.element instanceof HTMLElement)
            root = app.element;
        else if (html instanceof HTMLElement)
            root = html;
        else if (html && typeof html.find === "function") {
            const el = html[0] || html.find?.("footer")?.[0];
            if (el)
                root = el;
        }
        if (!root)
            return;
        let footer = root.querySelector("footer.directory-footer") || root.querySelector("footer");
        if (!footer) {
            setTimeout(tryAdd, 120);
            return;
        }
        if (footer.querySelector("[data-action='ai-generate-npc']"))
            return;
        const label = game.i18n?.localize?.("PF2E.Actor.AiNpcGenerator.Generate") || "Generate NPC";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.action = "ai-generate-npc";
        btn.innerHTML = `<i class="fa-solid fa-dice-d20"></i> ${label}`;
        btn.addEventListener("click", (ev) => {
            ev.preventDefault();
            try {
                launchNpcGenerator();
            }
            catch (e) {
                console.error(e);
                ui.notifications?.error?.("Failed to open PF2e AI NPC Generator");
            }
        });
        footer.appendChild(btn);
    };
    tryAdd();
});
globalThis.pf2eAiNpcGenerator = {
    launch: () => launchNpcGenerator(),
};
