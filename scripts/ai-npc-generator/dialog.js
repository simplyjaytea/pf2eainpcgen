// src/ai-npc-generator/dialog.ts
// Standalone dialog (no @ imports)
import { DeepSeekClient } from "./deepseek.js";
import { resolveNpcData } from "./resolver.js";
import { createNpcFromResolved } from "./creator.js";
function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
}
class NpcGeneratorDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "pf2e-ai-npc-generator",
        tag: "form",
        window: { icon: "fa-solid fa-dice-d20", title: "PF2E.Actor.AiNpcGenerator.Title", contentClasses: ["standard-form"] },
        position: { width: 480 },
        form: { handler: NpcGeneratorDialog.#onSubmit },
    };
    static PARTS = {
        form: { template: "modules/pf2e-ai-npc-generator/templates/ai-npc-generator-dialog.hbs" },
        footer: { template: "templates/generic/form-footer.hbs" },
    };
    async _prepareContext(options) {
        const ctx = await super._prepareContext(options);
        const lastPrompt = game.settings.get("pf2e-ai-npc-generator", "lastPrompt") || "";
        const lastLevel = game.settings.get("pf2e-ai-npc-generator", "lastLevel") || this.#defaultLevel();
        return Object.assign(ctx, {
            rootId: "ai-npc-generator",
            defaultLevel: this.#defaultLevel(),
            lastPrompt,
            lastLevel,
        });
    }
    async _preparePartContext(partId, context, options) {
        const c = await super._preparePartContext(partId, context, options);
        if (partId === "footer") {
            c.buttons = [
                { type: "submit", label: "PF2E.Actor.AiNpcGenerator.Generate", icon: "fa-solid fa-dice-d20" },
                { type: "button", label: "COMMON.Cancel", action: "close" },
            ];
        }
        return c;
    }
    #defaultLevel() {
        const party = game.actors.party;
        const members = (party?.members || []).filter((a) => a?.type === "character");
        if (members.length) {
            const avg = Math.round(members.reduce((s, a) => s + (a.level || 1), 0) / members.length);
            return clamp(avg, 1, 25);
        }
        const pcs = game.actors.filter((a) => a?.type === "character" && a.hasPlayerOwner);
        if (pcs.length) {
            const avg = Math.round(pcs.reduce((s, a) => s + (a.level || 1), 0) / pcs.length);
            return clamp(avg, 1, 25);
        }
        return 1;
    }
    async _onRender(context, options) {
        await super._onRender(context, options);
        const html = this.element;
        const range = html.querySelector("range-picker[name=level]");
        if (range) {
            const last = game.settings.get("pf2e-ai-npc-generator", "lastLevel") || this.#defaultLevel();
            range.value = String(last);
        }
        html.querySelector("a[data-action=toggle-advanced]")?.addEventListener("click", () => {
            html.querySelector("section.advanced")?.classList.toggle("hidden");
        });
    }
    _onChangeForm(config, ev) {
        super._onChangeForm?.(config, ev);
        const lvlEl = this.element.querySelector("range-picker[name=level]");
        const prev = this.element.querySelector("[data-preview-level-dc]");
        if (lvlEl && prev) {
            const lvl = Number(lvlEl.value || 1);
            const pwol = game.pf2e?.settings?.variants?.pwol?.enabled;
            const dc = game.pf2e?.dc?.calculateDC ? game.pf2e.dc.calculateDC(lvl, { pwol }) : 14 + lvl;
            prev.textContent = `Level ${lvl} (DC ${dc})`;
        }
    }
    static async #onSubmit(ev, _form, fd) {
        ev.preventDefault();
        if (!game.user.isGM) {
            ui.notifications.error("PF2E.ErrorMessage.GMOnly", { localize: true });
            return;
        }
        const data = fd.object || {};
        const prompt = String(data.prompt || "").trim();
        const level = clamp(Number(data.level) || 1, 1, 25);
        await game.settings.set("pf2e-ai-npc-generator", "lastPrompt", prompt);
        await game.settings.set("pf2e-ai-npc-generator", "lastLevel", level);
        const apiKey = String(data.apiKey || "").trim() || game.settings.get("pf2e-ai-npc-generator", "apiKey");
        if (!apiKey) {
            ui.notifications.error("PF2E.Actor.AiNpcGenerator.NoApiKey", { localize: true });
            return;
        }
        const client = new DeepSeekClient(apiKey);
        const prog = ui.notifications.info("PF2E.Actor.AiNpcGenerator.Generating", { progress: true });
        try {
            const schema = await client.generateNpc(prompt, level);
            prog.update({ message: "PF2E.Actor.AiNpcGenerator.Resolving", pct: 0.4 });
            const { resolved, warnings } = await resolveNpcData(schema);
            if (warnings.length) {
                const ok = await foundry.applications.api.DialogV2.confirm({
                    window: { title: "PF2E.Actor.AiNpcGenerator.WarningsTitle" },
                    content: `<p>${game.i18n.localize("PF2E.Actor.AiNpcGenerator.WarningsIntro")}</p>
                              <ul>${warnings.map((w) => `<li>${w}</li>`).join("")}</ul>
                              <p>${game.i18n.localize("PF2E.Actor.AiNpcGenerator.ProceedAnyway")}</p>`,
                    yes: { default: true },
                });
                if (!ok) {
                    prog.update({ message: "Cancelled", pct: 1 });
                    return;
                }
            }
            prog.update({ message: "PF2E.Actor.AiNpcGenerator.Creating", pct: 0.7 });
            const actor = await createNpcFromResolved(resolved, { promptUsed: prompt });
            prog.update({ message: "PF2E.Actor.AiNpcGenerator.Done", pct: 1 });
            ui.notifications.info(`Created ${actor.name}`);
            actor.sheet.render(true);
            // Close this dialog reliably (we are in a static handler)
            try {
                const app = foundry?.applications?.instances?.get?.("pf2e-ai-npc-generator");
                app?.close?.();
            }
            catch { /* ignore */ }
        }
        catch (e) {
            console.error(e);
            prog.update({ message: "PF2E.Actor.AiNpcGenerator.Failed", pct: 1 });
            ui.notifications.error("PF2E.Actor.AiNpcGenerator.FailedDetails", { localize: true, format: { message: String(e?.message || e) } });
        }
    }
}
export async function launchNpcGenerator() {
    if (!game.user.isGM) {
        ui.notifications.error("PF2E.ErrorMessage.GMOnly", { localize: true });
        return;
    }
    const dlg = new NpcGeneratorDialog();
    dlg.render(true);
}
