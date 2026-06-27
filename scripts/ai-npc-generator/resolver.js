// src/ai-npc-generator/resolver.ts
// Standalone resolver using only global game.packs (no @ imports)
const PACKS = {
    weapons: "pf2e.equipment-srd",
    actions: "pf2e.actionspf2e",
    spells: "pf2e.spells-srd",
};
const FIELDS = ["system.slug", "name", "type"];
function slugify(s) {
    return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
async function getIndexMap(packId) {
    const pack = game.packs.get(packId);
    if (!pack)
        return new Map();
    const idx = await pack.getIndex({ fields: FIELDS });
    const m = new Map();
    for (const e of idx) {
        const s = e?.system?.slug || slugify(e?.name || "");
        if (s)
            m.set(s, e._id);
    }
    return m;
}
function findClosest(wanted, map) {
    if (!wanted)
        return null;
    if (map.has(wanted))
        return wanted;
    const stripped = wanted.replace(/^(greater|major|minor|lesser)-/, "").replace(/-greater$/, "");
    if (map.has(stripped))
        return stripped;
    return null;
}
export async function resolveNpcData(schema) {
    const warnings = [];
    const resolved = { ...schema, items: [] };
    const [wMap, aMap, sMap] = await Promise.all([
        getIndexMap(PACKS.weapons),
        getIndexMap(PACKS.actions),
        getIndexMap(PACKS.spells),
    ]);
    for (const it of schema.items || []) {
        const copy = JSON.parse(JSON.stringify(it || {}));
        const sys = copy.system || (copy.system = {});
        if (it.type === "weapon" && sys.slug) {
            const want = slugify(sys.slug);
            if (!wMap.has(want)) {
                const alt = findClosest(want, wMap);
                if (alt && alt !== want) {
                    warnings.push(`Weapon slug "${want}" not found; using "${alt}"`);
                    sys.slug = alt;
                }
                else {
                    warnings.push(`Weapon slug "${want}" not found; name-match or unresolved.`);
                }
            }
        }
        if (it.type === "action" && sys.slug) {
            const want = slugify(sys.slug);
            if (!aMap.has(want)) {
                const alt = findClosest(want, aMap);
                if (alt && alt !== want) {
                    warnings.push(`Action slug "${want}" not found; using "${alt}"`);
                    sys.slug = alt;
                }
            }
        }
        if (it.type === "spell" && sys.slug) {
            const want = slugify(sys.slug);
            if (!sMap.has(want)) {
                const alt = findClosest(want, sMap);
                if (alt && alt !== want) {
                    warnings.push(`Spell slug "${want}" not found; using "${alt}"`);
                    sys.slug = alt;
                }
            }
        }
        resolved.items.push(copy);
    }
    const hasWeapon = resolved.items.some((i) => i.type === "weapon");
    if (!hasWeapon)
        warnings.push("No weapons provided; NPC will use natural attacks only.");
    return { resolved, warnings };
}
