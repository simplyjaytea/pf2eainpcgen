// src/ai-npc-generator/dialog.ts
// Standalone dialog (no @ imports)

import { DeepSeekClient } from "./deepseek.js";
import { resolveNpcData } from "./resolver.js";
import { createNpcFromResolved } from "./creator.js";

function clamp(n: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, n));
}

class NpcGeneratorDialog extends (foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) as any) {
    static DEFAULT_OPTIONS = {
        id: "pf2e-ai-npc-generator",
        tag: "form",
        window: { icon: "fa-solid fa-dice-d20", title: "PF2E.Actor.AiNpcGenerator.Title", contentClasses: ["standard-form"] },
        position: { width: 480 },
        form: { handler: (NpcGeneratorDialog as any).#onSubmit },
    };

    static PARTS = {
        form: { template: "modules/pf2e-ai-npc-generator/templates/ai-npc-generator-dialog.hbs" },
        footer: { template: "templates/generic/form-footer.hbs" },
    };

    async _prepareContext(options: any) {
        const ctx: any = await super._prepareContext(options);
        const lastPrompt = (game as any).settings.get("pf2e-ai-npc-generator", "lastPrompt") || "";
        const lastLevel = (game as any).settings.get("pf2e-ai-npc-generator", "lastLevel") || this.#defaultLevel();
        return Object.assign(ctx, {
            rootId: "ai-npc-generator",
            defaultLevel: this.#defaultLevel(),
            lastPrompt,
            lastLevel,
        });
    }

    async _preparePartContext(partId: string, context: any, options: any) {
        const c: any = await super._preparePartContext(partId, context, options);
        if (partId === "footer") {
            c.buttons = [
                { type: "submit", label: "PF2E.Actor.AiNpcGenerator.Generate", icon: "fa-solid fa-dice-d20" },
                { type: "button", label: "COMMON.Cancel", action: "close" },
            ];
        }
        return c;
    }

    #defaultLevel(): number {
        const party = (game as any).actors.party;
        const members = (party?.members || []).filter((a: any) => a?.type === "character");
        if (members.length) {
            const avg = Math.round(members.reduce((s: number, a: any) => s + (a.level || 1), 0) / members.length);
            return clamp(avg, 1, 25);
        }
        const pcs = (game as any).actors.filter((a: any) => a?.type === "character" && a.hasPlayerOwner);
        if (pcs.length) {
            const avg = Math.round(pcs.reduce((s: number, a: any) => s + (a.level || 1), 0) / pcs.length);
            return clamp(avg, 1, 25);
        }
        return 1;
    }

    async _onRender(context: any, options: any) {
        await super._onRender(context, options);
        const html = this.element as HTMLElement;

        const range = html.querySelector("range-picker[name=level]") as any;
        if (range) {
            const last = (game as any).settings.get("pf2e-ai-npc-generator", "lastLevel") || this.#defaultLevel();
            range.value = String(last);
        }
        html.querySelector("a[data-action=toggle-advanced]")?.addEventListener("click", () => {
            html.querySelector("section.advanced")?.classList.toggle("hidden");
        });
    }

    _onChangeForm(config: any, ev: Event) {
        super._onChangeForm?.(config, ev);
        const lvlEl = (this.element as HTMLElement).querySelector("range-picker[name=level]") as any;
        const prev = (this.element as HTMLElement).querySelector("[data-preview-level-dc]") as HTMLElement;
        if (lvlEl && prev) {
            const lvl = Number(lvlEl.value || 1);
            const pwol = (game as any).pf2e?.settings?.variants?.pwol?.enabled;
            const dc = (game as any).pf2e?.dc?.calculateDC ? (game as any).pf2e.dc.calculateDC(lvl, { pwol }) : 14 + lvl;
            prev.textContent = `Level ${lvl} (DC ${dc})`;
        }
    }

    static async #onSubmit(this: NpcGeneratorDialog, ev: SubmitEvent, _form: HTMLFormElement, fd: any) {
        ev.preventDefault();
        if (!(game as any).user.isGM) {
            ui.notifications.error("PF2E.ErrorMessage.GMOnly", { localize: true });
            return;
        }
        const data = fd.object || {};
        const prompt = String(data.prompt || "").trim();
        const level = clamp(Number(data.level) || 1, 1, 25);

        await (game as any).settings.set("pf2e-ai-npc-generator", "lastPrompt", prompt);
        await (game as any).settings.set("pf2e-ai-npc-generator", "lastLevel", level);

        const apiKey = String(data.apiKey || "").trim() || ((game as any).settings.get("pf2e-ai-npc-generator", "apiKey") as string);
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
                const ok = await (foundry as any).applications.api.DialogV2.confirm({
                    window: { title: "PF2E.Actor.AiNpcGenerator.WarningsTitle" },
                    content: `<p>${(game as any).i18n.localize("PF2E.Actor.AiNpcGenerator.WarningsIntro")}</p>
                              <ul>${warnings.map((w) => `<li>${w}</li>`).join("")}</ul>
                              <p>${(game as any).i18n.localize("PF2E.Actor.AiNpcGenerator.ProceedAnyway")}</p>`,
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
                const app = (foundry as any)?.applications?.instances?.get?.("pf2e-ai-npc-generator");
                app?.close?.();
            } catch { /* ignore */ }
        } catch (e: any) {
            console.error(e);
            prog.update({ message: "PF2E.Actor.AiNpcGenerator.Failed", pct: 1 });
            ui.notifications.error("PF2E.Actor.AiNpcGenerator.FailedDetails", { localize: true, format: { message: String(e?.message || e) } });
        }
    }
}

export async function launchNpcGenerator() {
    if (!(game as any).user.isGM) {
        ui.notifications.error("PF2E.ErrorMessage.GMOnly", { localize: true });
        return;
    }
    const dlg = new NpcGeneratorDialog();
    (dlg as any).render(true);
}
