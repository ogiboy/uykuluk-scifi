# Issue Tracker: GitHub

Issues and product requirement drafts for this repository live as GitHub issues. Use the `gh` CLI
for tracker operations and infer the repository from the current Git remote.

## Conventions

- Create: `gh issue create --title "..." --body-file <path>`.
- Read: `gh issue view <number> --comments` and include labels in structured queries.
- List: `gh issue list --state open --json number,title,body,labels,comments` with narrow filters.
- Comment: `gh issue comment <number> --body "..."`.
- Label: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`.
- Close: `gh issue close <number> --comment "..."`.

Use a temporary body file for multiline content so shell expansion cannot change the issue text.
Publishing to the issue tracker means creating or updating a GitHub issue.

## Pull Requests As A Request Surface

**No.** Pull requests are delivery and review surfaces, not feature-request intake. A bare GitHub
number can still refer to either an issue or a pull request; resolve the type before mutating it.

## Wayfinding

When `wayfinder` is explicitly selected, keep one map issue with linked child issues. Prefer GitHub
sub-issues and native dependencies when the repository supports them. Otherwise use a task list in
the map body, a `Part of #<map>` line in each child, and explicit `Blocked by: #<issue>` references.
Claiming a ticket is the first write; research and route discovery remain read-only until then.
