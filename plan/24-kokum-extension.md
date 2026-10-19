# 24 · Kokum: a later extension

**Decision (you, 19 October 2026):** Kokum, which helps people keep track of their kitchen, order groceries and decide what to cook, **can later become an extension of this app** (or be bundled with it). It is **not part of the current build**: nothing in the MVP builds or depends on Kokum. Choices that keep a later extension easy (an ingredient dictionary with Hinglish aliases, deterministic engines, the same Expo and Supabase stack) are kept.

## What this means for the plan

| Area | Effect |
|---|---|
| MVP scope | No Kokum screens, tables or engine code in this build |
| Database | No `household_id`, no Kokum recipe formats, no `kokum_cook` log source (file 12) |
| Design | The colour choice is made for this app on its own merits; sharing Kokum's petrol teal is optional, not required (file 09) |
| Roadmap | The extension comes after the fitness MVP is proven; its shape (in-app section or bundle) is decided then |
| Research | H-13 (pantry-aware suggestions) moves to Kokum's own research |

## What this app still borrows from Kokum (ideas, not code or data)

These are design patterns from the Kokum repository (claim K-01) that work well for any app that uses a language model, so they are reused here on their own merits:

1. **Code decides, the model explains.** Every number and safety decision is computed by tested code (file 13).
2. **Validate model output against real data.** Unknown IDs are dropped; facts come from our own records.
3. **Hard constraints apply everywhere.** Allergies and dietary rules filter suggestions and searches alike.
4. **Graceful degradation.** The app works without the network or the model.
5. **Honesty conventions.** No emoji; unverified data is labelled; quantities are checked before use.

## When the extension is planned

Decisions for that time, not now: shared sign-in across both apps; whether meals cooked in Kokum can be sent to this app as meal-log drafts (with the user confirming portions); one subscription or two; a shared ingredient dictionary with Hinglish aliases; and data-sharing consent between the two apps.
