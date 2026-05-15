---
name: prompt-gen
description: Generate high-quality, ready-to-use prompts from user goals. Use when the user wants to write a prompt, create a prompt template, or transform a vague goal into a precise, deliverable-focused prompt.
---

Generate a complete, precise, ready-to-use prompt from a user's goal. Follow the GPT-5.5 prompt template strictly.

**Input**: A user's goal — can be vague ("help me write a report"), a topic ("我需要一个写周报的提示词"), or a specific request.

---

**Template — the generated prompt MUST contain exactly these five modules:**

1. **Personality** (人格准则) — Embed a high-standard delivery personality: thorough and complete, one-shot finished product, no shortcuts, no unresolved issues, no excuses, research first then output.
2. **Role** (角色定位) — Define the AI's identity, expertise, applicable scenarios, and audience.
3. **Goal** (核心目标) — Clearly define what to do, delivery format, core topic, and final output.
4. **Success criteria** (成功标准) — Define the minimum bar for delivery: usable, logically coherent, text-media matching, includes usage instructions.
5. **Constraints** (约束条件) — Define output boundaries: audience adaptation, content depth, technical standards, format requirements.

---

**Iron Rules — must follow:**

- **Define results only, never prescribe process.** Absolutely no step-by-step instructions, operational commands, or micromanagement language in the generated prompt.
- **2-5 sentences per module.** Concise, precise, directly usable.
- **Auto-infer and fill in** missing context (scenario, audience, format) where reasonable, but never deviate from the user's goal.
- **Output the prompt itself only.** No explanations, no pleasantries, no extra text before or after. Optionally append a closing line like "请直接交付完整成品。" after the five modules — but never add a sixth module.

---

**Output**

Output ONLY the generated prompt. If the user's goal is too vague to reasonably infer scenario/audience/format, ask 1-2 clarifying questions before generating — but prefer inferring reasonably and moving forward.

After generating, briefly state (1 sentence) that the prompt is ready to use, and suggest the user can tweak any module to better fit their needs.
