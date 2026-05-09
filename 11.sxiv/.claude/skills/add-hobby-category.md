---
name: add-hobby-category
description: Add one or more new hobby categories to the SXIVA dashboard's HOBBY_CATEGORIES array. Use when the user says "add [xyz] as a hobby category" or lists category codes (e.g., "add wre wrf wri as hobby categories").
---

# Add Hobby Category Skill

You are helping the user add one or more new hobby categories to the SXIVA dashboard.

## Instructions

1. **Extract the category code(s)** from the user's message. The user may give one or several at once — examples: "add [xyz] as a hobby category", "add wrs", "add wre wrf wri wrj wro". Strip any surrounding `[ ]` and collect the codes in the order given.

2. **Update the frontend JavaScript** file at `/home/slackwing/src/feathers/foundry/website/html/status/js/app.js`:
   - Find the line: `const HOBBY_CATEGORIES = ['wf', 'wr', ...];`
   - Append each new category code to the end of the array, in the order the user gave them. Do not sort.
   - Skip any code that's already present (don't duplicate).
   - Use the Edit tool to make this change.

3. **Commit the change** using git:
   - Stage the changed file with `git add`.
   - Commit message format:
     - Single category: `feat(sxiva): add [xyz] as hobby category`
     - Multiple categories: `feat(sxiva): add [a], [b], [c] as hobby categories`
   - DO NOT push to remote unless the user explicitly asks.

4. **Confirm to the user** which categories were added (and which, if any, were already present and skipped), then remind them to deploy by running:
   ```
   ssha ; feathers ; html ; ws_prod
   ```

## Important Notes

- The backend API doesn't need changes — it dynamically queries categories from the database.
- Once .sxiva files with the new category are synced, they'll automatically appear in the dashboard.
- Only modify the HOBBY_CATEGORIES array in the frontend JavaScript file.
