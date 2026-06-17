# Operator Workflow

```sh
pnpm producer init
pnpm producer ideas
pnpm producer approve idea --run <run_id> --idea <idea_id>
pnpm producer script --run <run_id>
pnpm producer review script --run <run_id>
pnpm producer approve script --run <run_id>
pnpm producer package --run <run_id>
pnpm producer estimate --run <run_id>
pnpm producer evidence --run <run_id>
pnpm producer readiness --run <run_id>
```

Stop after every approval point and inspect the saved artifacts before continuing.
