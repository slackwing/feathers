# Add Hobby Category Skill

You are helping the user add a new hobby category to the SXIVA dashboard.

## Instructions

1. **Extract the category code** from the user's message. The user will say something like "add [xyz] as a hobby category" or "add [wrs] as a hobby category". Extract the category code (e.g., "xyz", "wrs").

2. **Update the frontend JavaScript** file at `/home/slackwing/src/feathers/foundry/website/html/status/js/app.js`:
   - Find the line: `const HOBBY_CATEGORIES = ['wf', 'wr', ...];`
   - Add the new category code to the end of the array (keep it alphabetically unsorted, just append)
   - Use the Edit tool to make this change

3. **Commit the change** using git:
   - Use `git add` to stage the changed file
   - Create a commit with the message: `feat(sxiva): add [xyz] as hobby category` (where xyz is the actual category code)
   - DO NOT push to remote unless the user explicitly asks

4. **Confirm to the user** that the category has been added and committed.

## Important Notes

- The backend API doesn't need changes - it dynamically queries categories from the database
- Once .sxiva files with the new category are synced, they'll automatically appear in the dashboard
- Only modify the HOBBY_CATEGORIES array in the frontend JavaScript file
- Always commit with the exact format: `feat(sxiva): add [category] as hobby category`
