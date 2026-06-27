# PF2e AI NPC Generator

GM-only AI-powered NPC generator for the **Pathfinder 2e** Foundry system.

- Uses **DeepSeek** (OpenAI-compatible) to generate a small prompt + level into a fully automated, compendium-driven NPC.
- Weapons placed in inventory; linked melee strikes (`flags.pf2e.linkedWeapon`).
- AI chooses level-appropriate **weapons, armor, feats, and consumables** from compendiums.
- Modal progress overlay (Contacting → Resolving → Creating → Finalizing).
- Strong base prompt + your text as a modifier.
- Remembers last prompt + level (client-scoped).
- Button labeled **"Generate NPC"** (d20 icon) in the Actors sidebar footer (GM-only).
- Encounter Builder section present but disabled ("Coming soon").
- Always runs an optimize pass (level-based DC + HP).
- Hybrid slug handling with user confirmation for substitutes.

## Requirements

- **Foundry VTT** v13+
- **PF2e** system v6+
- A **DeepSeek API key** (https://platform.deepseek.com)

## Install

### Fast dev install (recommended for updates)
This repo publishes from `main` on every push:

1. In Foundry → **Install Module** → paste:
   `https://raw.githubusercontent.com/simplyjaytea/pf2eainpcgen/main/module.json`
2. Enable the module.
3. As GM, open the **Actors** sidebar — look for the **"Generate NPC"** button.

After any fix we bump the version, so Foundry will detect the update on refresh.

### Manual / git clone
1. Clone this repo.
2. Copy into `Data/modules/pf2e-ai-npc-generator`.
3. `npm install && npm run build`.
4. Enable + restart world.

## Setup

1. As GM, go to **Configure Settings → Module Settings → PF2e AI NPC Generator**.
2. Paste your DeepSeek API key (client-scoped only). It never appears in the generator dialog.

## Usage

1. Click **Generate NPC** in the Actors sidebar (GM-only).
2. Enter a short concept prompt (e.g. `cunning drow assassin with hand crossbow and poison`).
3. Choose a level (1–25). Defaults to average party level (falls back to player-owned PCs).
4. Click **Generate**.
5. If any slugs can’t be resolved exactly, you’ll see a confirmation dialog listing substitutes.
6. On success, the NPC is created with:
   - Weapons/armor in inventory
   - Linked melee attacks
   - Feats and consumables as requested by the model
   - Optimized base HP + default NPC artwork

The sheet opens automatically.

## How it works (high level)

1. Dialog → DeepSeek (JSON mode) with a strict schema.
2. Resolver loads compendium indices (weapons/actions/spells) and does fuzzy slug matching.
3. Creator:
   - Creates the NPC
   - Resolves weapons/armor/feats/consumables from compendiums (or minimal fallbacks)
   - Places items in inventory, generates linked melee via `toNPCAttacks`
   - Adds actions/spells/lore
   - Applies HP optimization
4. Always ends with `actor.reset()` so derived data (strikes, MAP, REs) is correct.

## Files of interest

- `src/module.ts` — settings + sidebar button injection
- `src/ai-npc-generator/dialog.ts` — ApplicationV2 dialog
- `src/ai-npc-generator/deepseek.ts` — DeepSeek client + schema
- `src/ai-npc-generator/resolver.ts` — slug resolution + warnings
- `src/ai-npc-generator/creator.ts` — NPC creation + linked melee + optimize

## Notes & Limitations

- Only GM can use it (enforced server-side and in UI).
- Relies on PF2e compendiums for fidelity. Natural attacks without a matching weapon fall back to synthesized melee items.
- DeepSeek occasionally returns empty content; the client retries a couple of times.
- Level “parse from prompt” is intentionally not done; use the explicit slider.

## Development

```bash
npm install
npm run build     # emits to scripts/
npm run watch
```

The built `scripts/*.js` are what Foundry loads. The `scripts/` folder is intentionally committed for one-step usage after `git clone`.

## License

MIT (or your preferred). Add a `LICENSE` file if you want to pin it.

## Credits

Built for the PF2e system. Uses official PF2e patterns (`toNPCAttacks`, linked weapons, `calculateDC`, `getHpAdjustment`, party level averaging, ActorDirectory injection).

## Support

Open an issue with:
- PF2e system version
- Foundry version
- Prompt + level used
- Any warnings shown
- Console errors (F12)

## Release Checklist

- [ ] Bump `version` in `module.json`
- [ ] Update `verified` Foundry/PF2e versions if needed
- [ ] Run `npm run build` (ensure `scripts/` is up to date)
- [ ] Commit & push
- [ ] Create a GitHub Release (tag = `vX.Y.Z`)
- [ ] Attach a `.zip` of the module folder (optional but friendly)
- [ ] Fill in `manifest` + `download` in `module.json` pointing to the release assets
- [ ] Push the manifest URL so people can use "Install Module" in Foundry

Example manifest URL after tagging v0.2.0:
`https://github.com/simplyjaytea/pf2eainpcgen/releases/download/v0.2.0/module.json`
