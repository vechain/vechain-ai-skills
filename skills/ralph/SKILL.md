---
name: ralph
description: "Autonomous agent runner that implements features from PRDs. Converts PRDs to prd.json, then executes user stories one at a time via Claude CLI. Triggers on: convert this prd, turn this into ralph format, create prd.json, ralph json, run ralph, ralph setup."
license: MIT
---

# Ralph — Autonomous Agent Runner

Ralph is a bash script that runs Claude autonomously to implement features from a PRD. It processes one user story per iteration, commits after each, and stops when the PRD is complete.

---

## First-time Setup

When the user first invokes Ralph, check if the project is set up:

1. If `ralph.sh` doesn't exist in the project root, create it from `references/ralph-script.md` (in this skill's directory)
2. Make it executable: `chmod +x ralph.sh`
3. Add to `.gitignore` if not already present: `prd.json`, `progress.txt`
4. Create `tasks/` directory if it doesn't exist
5. Create empty `progress.txt` if it doesn't exist
6. Verify `jq` is installed (`which jq`); if not, tell the user to install it (`brew install jq`)

---

## Workflow

1. **Create a PRD** using the `prd` skill → saves to `tasks/prd-[feature-name].md`
2. **Convert the PRD** to `prd.json` using the conversion rules below
3. **Run Ralph** in a separate terminal: `./ralph.sh 10` (number = max iterations)
4. **Wait for completion** — Ralph implements each story and commits

---

## PRD to prd.json Conversion

### Output Format

```json
{
    "project": "[Project Name]",
    "branchName": "ralph/[feature-name-kebab-case]",
    "description": "[Feature description from PRD title/intro]",
    "userStories": [
        {
            "id": "US-001",
            "title": "[Story title]",
            "description": "As a [user], I want [feature] so that [benefit]",
            "acceptanceCriteria": [
                "Criterion 1",
                "Criterion 2",
                "Typecheck passes"
            ],
            "priority": 1,
            "passes": false,
            "notes": ""
        }
    ]
}
```

### Conversion Rules

1. **Each user story becomes one JSON entry**
2. **IDs**: Sequential (US-001, US-002, etc.)
3. **Priority**: Based on dependency order, then document order
4. **All stories**: `passes: false` and empty `notes`
5. **branchName**: Derive from feature name, kebab-case, prefixed with `ralph/`
6. **Always add**: "Typecheck passes" to every story's acceptance criteria

---

## Story Size: The Number One Rule

**Each story must be completable in ONE Ralph iteration (one context window).**

Ralph spawns a fresh Claude instance per iteration with no memory of previous work. If a story is too big, the LLM runs out of context before finishing and produces broken code.

### Right-sized stories:

- Add a database column and migration
- Add a UI component to an existing page
- Update a server action with new logic
- Add a filter dropdown to a list

### Too big (split these):

- "Build the entire dashboard" → Split into: schema, queries, UI components, filters
- "Add authentication" → Split into: schema, middleware, login UI, session handling
- "Refactor the API" → Split into one story per endpoint or pattern

**Rule of thumb:** If you cannot describe the change in 2-3 sentences, it is too big.

---

## Story Ordering: Dependencies First

Stories execute in priority order. Earlier stories must not depend on later ones.

**Correct order:**

1. Schema/database changes (migrations)
2. Server actions / backend logic
3. UI components that use the backend
4. Dashboard/summary views that aggregate data

**Wrong order:**

1. UI component (depends on schema that does not exist yet)
2. Schema change

---

## Acceptance Criteria: Must Be Verifiable

Each criterion must be something Ralph can CHECK, not something vague.

### Good criteria (verifiable):

- "Add `status` column to tasks table with default 'pending'"
- "Filter dropdown has options: All, Active, Completed"
- "Clicking delete shows confirmation dialog"
- "Typecheck passes"
- "Tests pass"

### Bad criteria (vague):

- "Works correctly"
- "User can do X easily"
- "Good UX"
- "Handles edge cases"

### Always include as final criterion:

```text
"Typecheck passes"
```

For stories with testable logic, also include:

```text
"Tests pass"
```

For stories that change UI, also include:

```text
"Verify in browser"
```

Frontend stories are NOT complete until visually verified in the browser.

---

## Archiving Previous Runs & Reset

**Before writing a new prd.json, check if there is an existing one from a different feature:**

1. Read the current `prd.json` if it exists
2. Check if `branchName` differs from the new feature's branch name
3. If different AND `progress.txt` has content:
    - Create archive folder: `archive/YYYY-MM-DD-feature-name/`
    - Copy current `prd.json` and `progress.txt` to archive

**ALWAYS reset progress.txt:**

After writing the new `prd.json`, reset `progress.txt` to empty:

```bash
echo "" > progress.txt
```

---

## How Ralph Works (for reference)

Each iteration:

1. Find highest-priority story with `passes: false`
2. Implement the feature
3. Run type checks
4. Update `prd.json`: set `passes: true` and add notes
5. Append progress to `progress.txt`
6. Create a git commit

Stops when all stories have `passes: true` or iterations exhausted.

### Running Ralph

```bash
./ralph.sh 10    # Run up to 10 iterations
```

### Requirements

- `jq` installed (`brew install jq`)
- Claude CLI configured and authenticated

### Safety

- Ralph auto-switches to the branch specified in `prd.json`
- Refuses to run on `main` or `master`

---

## Checklist Before Saving prd.json

- [ ] **Previous run archived** (if prd.json exists with different branchName)
- [ ] Each story is completable in one iteration (small enough)
- [ ] Stories are ordered by dependency (schema → backend → UI)
- [ ] Every story has "Typecheck passes" as criterion
- [ ] UI stories have "Verify in browser" as criterion
- [ ] Acceptance criteria are verifiable (not vague)
- [ ] No story depends on a later story
- [ ] **progress.txt reset to empty** after writing prd.json
