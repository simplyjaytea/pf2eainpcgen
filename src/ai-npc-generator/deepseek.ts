// src/ai-npc-generator/deepseek.ts
// Minimal DeepSeek client (no external imports)

const DEEPSEEK_BASE = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-pro";

export interface DeepSeekNpcSchema {
    name: string;
    level: number;
    traits: string[];
    description?: string;
    size?: "tiny" | "sm" | "med" | "lg" | "huge" | "grg";
    items: DeepSeekNpcItem[];
}

export interface DeepSeekNpcItem {
    type: "weapon" | "melee" | "armor" | "action" | "feat" | "spellcastingEntry" | "spell" | "lore" | "consumable";
    name: string;
    system?: Record<string, any>;
}

interface DeepSeekResponse {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
}

const SYSTEM_PROMPT = `You are an expert Pathfinder 2e NPC designer.
Create a complete, playable, level-appropriate NPC.

Core rules:
- Output ONLY valid JSON. No markdown, no extra text.
- Choose items from PF2e compendiums (use real slugs/names when possible).
- Weapons, armor, consumables, feats, and actions must be reasonable for the level.
- Include at least one reliable attack (weapon preferred; fallback natural attack is OK).
- Add 1-3 useful feats or class features when they fit.
- Add armor if it makes sense for the concept.
- Add 0-3 consumables that are actually useful in combat or exploration.
- Keep it simple and effective. No over-optimization.

Required JSON schema (exact keys):

{
  "name": string,
  "level": integer 1-25,
  "traits": string[],
  "description": string,
  "size": "tiny" | "sm" | "med" | "lg" | "huge" | "grg" | undefined,
  "items": [
    {
      "type": "weapon" | "melee" | "armor" | "action" | "feat" | "spellcastingEntry" | "spell" | "lore" | "consumable",
      "name": string,
      "system": {
        "slug": string?,
        "damage": { "damageType": string, "dice": number, "die": string | null }?,
        "traits": { "value": string[] }?
      }
    }
  ]
}

The word "json" appears in this prompt.`;

export class DeepSeekClient {
    apiKey: string;
    model: string;
    maxRetries: number;

    constructor(apiKey: string, model = DEFAULT_MODEL, maxRetries = 2) {
        if (!apiKey) throw new Error("DeepSeek API key required");
        this.apiKey = apiKey;
        this.model = model;
        this.maxRetries = maxRetries;
    }

    async generateNpc(prompt: string, level: number): Promise<DeepSeekNpcSchema> {
        const base = `Design a solid, playable Pathfinder 2e NPC at level ${level}. Follow the system guidelines strictly.`;
        const userMod = prompt?.trim()
            ? `User concept / additional instructions: ${prompt.trim()}`
            : `Create a generic but interesting and effective foe for this level.`;
        const userPrompt = `${base}\n${userMod}\nReturn ONLY the JSON object.`;

        let lastErr: any;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const resp = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    body: JSON.stringify({
                        model: this.model,
                        messages: [
                            { role: "system", content: SYSTEM_PROMPT },
                            { role: "user", content: userPrompt },
                        ],
                        response_format: { type: "json_object" },
                        temperature: 0.3,
                        max_tokens: 4000,
                    }),
                });
                if (!resp.ok) {
                    const text = await resp.text().catch(() => "");
                    throw new Error(`DeepSeek HTTP ${resp.status}: ${text}`);
                }
                const data = (await resp.json()) as DeepSeekResponse;
                if (data.error) throw new Error(data.error.message || "DeepSeek error");
                const content = data.choices?.[0]?.message?.content;
                if (!content) {
                    if (attempt < this.maxRetries) continue;
                    throw new Error("Empty response");
                }
                let parsed: any;
                try {
                    parsed = JSON.parse(content);
                } catch {
                    const m = content.match(/\{[\s\S]*\}$/);
                    if (m) parsed = JSON.parse(m[0]);
                }
                return this.#normalize(parsed, level);
            } catch (e) {
                lastErr = e;
                if (attempt < this.maxRetries) {
                    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
                    continue;
                }
            }
        }
        throw lastErr || new Error("DeepSeek failed");
    }

    #normalize(raw: any, fallbackLevel: number): DeepSeekNpcSchema {
        const level = Math.max(1, Math.min(25, Math.floor(Number(raw?.level) || fallbackLevel)));
        const traits = Array.isArray(raw?.traits) ? raw.traits.filter((t: any) => typeof t === "string") : [];
        const items = Array.isArray(raw?.items)
            ? raw.items
                  .filter((i: any) => i && typeof i === "object")
                  .map((i: any) => ({
                      type: (i.type as any) || "action",
                      name: String(i.name || "Unnamed"),
                      system: i.system && typeof i.system === "object" ? { ...i.system } : {},
                  }))
            : [];
        return {
            name: raw?.name?.trim() || "Generated NPC",
            level,
            traits,
            description: typeof raw?.description === "string" ? raw.description : "",
            size: ["tiny", "sm", "med", "lg", "huge", "grg"].includes(String(raw?.size).toLowerCase())
                ? (String(raw.size).toLowerCase() as any)
                : undefined,
            items,
        };
    }
}
