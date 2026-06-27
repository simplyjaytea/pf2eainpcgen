# PF2e AI NPC Generator

GM-only AI-powered NPC generator for the **Pathfinder 2e** Foundry system.

- Uses **DeepSeek** (OpenAI-compatible) to generate a small prompt + level into a fully automated, compendium-driven NPC.
- Weapons are placed in inventory as physical items.
- Melee strikes are synthesized and linked (`flags.pf2e.linkedWeapon`) using the same logic as bestiary NPCs.
- Attachments/subitems are supported.
- Always runs an optimize pass (level-based DC + HP adjustment).
- Hybrid slug handling: warns + explicit user confirmation for substitutes.
- Default images for generated NPCs.
- Remembers last prompt + level (client-scoped).
- Button labeled **"Generate NPC"** (d20 icon) in the Actors sidebar footer (GM-only).

## Requirements

- **Foundry VTT** v13+
- **PF2e** system v6+
- A **DeepSeek API key** (https://platform.deepseek.com)

## Install

### From this repo (dev)
1. Clone or download this folder.
2. Copy the folder into your Foundry `Data/modules/pf2e-ai-npc-generator`.
3. Restart Foundry / refresh the world.
4. Enable the module in **Manage Modules**.
5. As GM, open the **Actors** sidebar — you’ll see a **"Generate NPC"** button in the footer.

### From a release (future)
Use the **Install Module** button in Foundry and paste the manifest URL.

## Setup

1. As GM, go to **Configure Settings → Module Settings → PF2e AI NPC Generator**.
2. Paste your DeepSeek API key (client-scoped).
3. (Optional) You can also paste/override the key in the dialog’s **Advanced** section.

## Usage

1. Click **Generate NPC** in the Actors sidebar (GM-only).
2. Enter a short concept prompt (e.g. `cunning drow assassin with hand crossbow and poison`).
3. Choose a level (1–25). Defaults to average party level (falls back to player-owned PCs).
4. Click **Generate**.
5. If any slugs can’t be resolved exactly, you’ll see a confirmation dialog listing substitutes.
6. On success, the NPC is created with:
   - Weapons in inventory (held)
   - Linked melee attacks
   - Optimized base HP
   - Default NPC artwork

The sheet opens automatically.

## How it works (high level)

1. Dialog → DeepSeek (JSON mode) with a strict schema.
2. Resolver loads compendium indices (weapons/actions/spells) and does fuzzy slug matching.
3. Creator:
   - Creates the NPC
   - Places weapons as physical items (inventory)
   - Generates linked melee via `WeaponPF2e#toNPCAttacks`
   - Adds other items (actions, spells, lore, consumables)
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
