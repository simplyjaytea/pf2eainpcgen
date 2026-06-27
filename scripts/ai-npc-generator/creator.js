// src/ai-npc-generator/creator.ts
// Standalone creator (no @ imports)
const WEAPONS = "pf2e.equipment-srd";
const ACTIONS = "pf2e.actionspf2e";
const SPELLS = "pf2e.spells-srd";
function slugify(s) {
    return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
}
async function resolveWeapon(ai) {
    const want = slugify(ai.system?.slug || ai.name);
    const pack = game.packs.get(WEAPONS);
    if (!pack)
        return null;
    const idx = await pack.getIndex({ fields: ["system.slug"] });
    let hit = idx.find((e) => (e.system?.slug || slugify(e.name)) === want);
    if (!hit)
        hit = idx.find((e) => (e.name || "").toLowerCase() === ai.name.toLowerCase());
    if (!hit)
        return null;
    const doc = await pack.getDocument(hit._id);
    if (!doc || doc.type !== "weapon")
        return null;
    const clone = doc.clone({}, { keepId: false });
    const d = ai.system?.damage || {};
    if (d.damageType || d.dice || d.die) {
        clone.updateSource({
            "system.damage.damageType": d.damageType || clone.system.damage.damageType,
            "system.damage.dice": d.dice ?? clone.system.damage.dice,
            "system.damage.die": d.die ?? clone.system.damage.die,
        });
    }
    if (Array.isArray(ai.system?.traits?.value)) {
        clone.updateSource({ "system.traits.value": ai.system.traits.value });
    }
    return clone;
}
function synthesizeMelee(ai, level) {
    const d = ai.system?.damage || {};
    const dice = d.dice ?? clamp(Math.floor((level + 2) / 3), 1, 6);
    const die = d.die || "d6";
    const dt = d.damageType || "bludgeoning";
    const traits = Array.isArray(ai.system?.traits?.value) ? ai.system.traits.value : [];
    return {
        type: "melee",
        name: ai.name,
        system: {
            slug: ai.system?.slug || slugify(ai.name),
            bonus: { value: level + 7 },
            damageRolls: { [foundry.utils.randomID()]: { damage: `${dice}${die}`, damageType: dt, category: null } },
            traits: { value: traits },
        },
    };
}
async function resolveAction(ai) {
    const want = slugify(ai.system?.slug || ai.name);
    const pack = game.packs.get(ACTIONS);
    if (pack) {
        const idx = await pack.getIndex({ fields: ["system.slug"] });
        const hit = idx.find((e) => (e.system?.slug || slugify(e.name)) === want);
        if (hit) {
            const doc = await pack.getDocument(hit._id);
            if (doc)
                return doc.toObject();
        }
    }
    return {
        type: "action",
        name: ai.name,
        system: { slug: want, description: { value: "" }, traits: { value: [] }, actionType: { value: "action" }, actions: { value: 1 } },
    };
}
async function resolveSpell(ai) {
    const want = slugify(ai.system?.slug || ai.name);
    const pack = game.packs.get(SPELLS);
    if (!pack)
        return null;
    const idx = await pack.getIndex({ fields: ["system.slug"] });
    const hit = idx.find((e) => (e.system?.slug || slugify(e.name)) === want);
    if (!hit)
        return null;
    const doc = await pack.getDocument(hit._id);
    return doc ? doc.toObject() : null;
}
async function resolveConsumable(ai) {
    return { type: "consumable", name: ai.name, system: { quantity: 1, consumableType: { value: "other" }, traits: { value: [] } } };
}
function calcDC(level) {
    try {
        return game.pf2e?.dc?.calculateDC?.(level) ?? 14 + level;
    }
    catch {
        return 14 + level;
    }
}
export async function createNpcFromResolved(schema, { promptUsed = "" } = {}) {
    const level = clamp(schema.level, 1, 25);
    const src = {
        name: schema.name || "Generated NPC",
        type: "npc",
        system: {
            details: { level: { value: level }, publicNotes: schema.description || "" },
            traits: { value: Array.isArray(schema.traits) ? schema.traits : [], rarity: "common", size: { value: schema.size || "med" } },
            attributes: { hp: { value: 1, max: 1 } },
        },
        img: "systems/pf2e/icons/default-icons/npc.svg",
        prototypeToken: { texture: { src: "systems/pf2e/icons/default-icons/npc.svg" }, actorLink: false },
        flags: { pf2e: { aiNpcGenerator: { prompt: promptUsed } } },
    };
    const actor = (await game.actors.create(src, { render: false }));
    const toCreate = [];
    for (const it of schema.items || []) {
        if (it.type === "weapon") {
            const w = await resolveWeapon(it);
            if (w) {
                const o = w.toObject();
                o.system.equipped = { carryType: "held", handsHeld: 1, inSlot: false };
                toCreate.push(o);
            }
            else {
                toCreate.push(synthesizeMelee(it, level));
            }
        }
        else if (it.type === "melee") {
            toCreate.push(synthesizeMelee(it, level));
        }
        else if (it.type === "action") {
            const a = await resolveAction(it);
            if (a)
                toCreate.push(a);
        }
        else if (it.type === "spell") {
            const s = await resolveSpell(it);
            if (s)
                toCreate.push(s);
        }
        else if (it.type === "consumable") {
            toCreate.push(await resolveConsumable(it));
        }
        else if (it.type === "lore") {
            toCreate.push({ type: "lore", name: it.name, system: { mod: { value: 0 } } });
        }
        else if (it.type === "spellcastingEntry") {
            toCreate.push({
                type: "spellcastingEntry",
                name: it.name,
                system: { prepared: { value: "innate" }, ability: { value: "cha" }, spelldc: { value: calcDC(level) }, tradition: { value: "arcane" }, showSlotlessLevels: { value: true } },
            });
        }
    }
    if (toCreate.length)
        await actor.createEmbeddedDocuments("Item", toCreate, { render: false });
    // Linked melee from weapons
    const melees = [];
    for (const w of actor.itemTypes.weapon || []) {
        const attacks = w.toNPCAttacks?.({ keepId: false }) || [];
        for (const atk of attacks) {
            atk.updateSource({ "flags.pf2e.linkedWeapon": w.id });
            melees.push(atk.toObject());
        }
    }
    if (melees.length)
        await actor.createEmbeddedDocuments("Item", melees, { render: false });
    // Basic HP
    const hp = Math.max(4, 6 + level * 6);
    await actor.update({ "system.attributes.hp": { value: hp, max: hp } }, { render: false });
    actor.reset();
    return actor;
}
