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
        const partyLevel = this.#defaultLevel();
        const i18n = game.i18n;
        return Object.assign(ctx, {
            rootId: "ai-npc-generator",
            defaultLevel: partyLevel,
            partyLevel,
            lastPrompt,
            lastLevel,
            encLabels: {
                title: i18n?.localize("PF2E.Actor.AiNpcGenerator.EncounterBuilder.Title") || "Encounter Builder",
                coming: i18n?.localize("PF2E.Actor.AiNpcGenerator.EncounterBuilder.ComingSoon") || "Coming soon",
                party: i18n?.localize("PF2E.Actor.AiNpcGenerator.EncounterBuilder.PartyLevel") || "Party Level",
                num: i18n?.localize("PF2E.Actor.AiNpcGenerator.EncounterBuilder.NumNPCs") || "Number of NPCs",
                diff: i18n?.localize("PF2E.Actor.AiNpcGenerator.EncounterBuilder.Difficulty") || "Difficulty",
                build: i18n?.localize("PF2E.Actor.AiNpcGenerator.EncounterBuilder.Build") || "Build Encounter",
                hint: i18n?.localize("PF2E.Actor.AiNpcGenerator.EncounterBuilder.Hint") || "This will create a group of level-appropriate NPCs for an encounter.",
            },
            genSteps: {
                contact: i18n?.localize("PF2E.Actor.AiNpcGenerator.Gen.Contacting") || "Contacting DeepSeek",
                resolve: i18n?.localize("PF2E.Actor.AiNpcGenerator.Gen.Resolving") || "Resolving compendium items",
                create: i18n?.localize("PF2E.Actor.AiNpcGenerator.Gen.Creating") || "Creating NPC",
                finalize: i18n?.localize("PF2E.Actor.AiNpcGenerator.Gen.Finalizing") || "Finalizing",
                hint: i18n?.localize("PF2E.Actor.AiNpcGenerator.Gen.Hint") || "This usually takes a few seconds.",
            },
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
        // Keep preview in sync
        this.#updateLevelPreview();
    }
    #updateLevelPreview() {
        const html = this.element;
        const lvlEl = html.querySelector("range-picker[name=level]");
        const prev = html.querySelector("[data-preview-level-dc]");
        if (lvlEl && prev) {
            const lvl = Number(lvlEl.value || 1);
            const pwol = game.pf2e?.settings?.variants?.pwol?.enabled;
            const dc = game.pf2e?.dc?.calculateDC ? game.pf2e.dc.calculateDC(lvl, { pwol }) : 14 + lvl;
            prev.textContent = `Level ${lvl} (DC ${dc})`;
        }
    }
    _onChangeForm(config, ev) {
        super._onChangeForm?.(config, ev);
        this.#updateLevelPreview();
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
        const html = this.element;
        const body = html.querySelector(".generator-body");
        const overlay = html.querySelector("[data-generator-overlay]");
        const statusEl = html.querySelector("[data-gen-status]");
        const barEl = html.querySelector("[data-gen-bar]");
        const titleEl = html.querySelector("[data-gen-title]");
        const stepEls = {
            contact: html.querySelector('[data-step="contact"]'),
            resolve: html.querySelector('[data-step="resolve"]'),
            create: html.querySelector('[data-step="create"]'),
            finalize: html.querySelector('[data-step="finalize"]'),
        };
        function setStep(step) {
            Object.values(stepEls).forEach(el => el?.classList.remove("active"));
            stepEls[step]?.classList.add("active");
        }
        function setStatus(text, pct) {
            if (statusEl)
                statusEl.textContent = text;
            if (barEl)
                barEl.style.width = `${Math.max(0, Math.min(100, Math.round(pct * 100)))}%`;
        }
        if (titleEl)
            titleEl.textContent = game.i18n?.localize("PF2E.Actor.AiNpcGenerator.Generating") || "Generating NPC…";
        // prime step labels
        const s = (k) => game.i18n?.localize(`PF2E.Actor.AiNpcGenerator.Gen.${k}`) || k;
        const map = { contact: "contact", resolve: "resolve", create: "create", finalize: "finalize" };
        for (const [k, el] of Object.entries(stepEls)) {
            if (el && map[k])
                el.textContent = s(map[k]);
        }
        // Show modal overlay
        if (body)
            body.style.opacity = "0.3";
        if (overlay)
            overlay.classList.remove("hidden");
        setStep("contact");
        setStatus("Contacting DeepSeek", 0.08);
        const client = new DeepSeekClient(apiKey);
        try {
            const schema = await client.generateNpc(prompt, level);
            setStep("resolve");
            setStatus("Resolving compendium items", 0.35);
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
                    setStatus("Cancelled", 1);
                    if (overlay)
                        overlay.classList.add("hidden");
                    if (body)
                        body.style.opacity = "1";
                    return;
                }
            }
            setStep("create");
            setStatus(game.i18n?.localize("PF2E.Actor.AiNpcGenerator.Gen.Creating") || "Creating NPC", 0.65);
            const actor = await createNpcFromResolved(resolved, { promptUsed: prompt });
            setStep("finalize");
            setStatus(game.i18n?.localize("PF2E.Actor.AiNpcGenerator.Gen.Finalizing") || "Finalizing", 0.92);
            ui.notifications.info(`Created ${actor.name}`);
            actor.sheet.render(true);
            // brief finish then close
            setTimeout(() => {
                try {
                    this.close();
                }
                catch { }
            }, 280);
        }
        catch (e) {
            console.error(e);
            setStatus("Failed: " + (e?.message || e), 1);
            ui.notifications.error("PF2E.Actor.AiNpcGenerator.FailedDetails", { localize: true, format: { message: String(e?.message || e) } });
            // leave overlay visible with failure so user can read it, allow close
        }
    }
    // Allow the user to close the dialog while the overlay is shown
    _onClose(options) {
        try {
            const html = this.element;
            const overlay = html?.querySelector?.("[data-generator-overlay]");
            if (overlay)
                overlay.classList.add("hidden");
        }
        catch { }
        return super._onClose(options);
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
