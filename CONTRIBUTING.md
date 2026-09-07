# Contributing

Thanks for helping make Apple apps accessible to AI assistants!

## Dev setup

```bash
git clone <your fork>
cd apple-mcp
npm install        # installs deps and builds dist/
npm run dev        # rebuild on change
npm test           # handshake smoke test (no Apple app access needed)
npm run inspector  # MCP Inspector web UI to call tools by hand
```

## Adding a new Apple app module

Each app is one file in `src/modules/`. Copy `notes.ts` as a template:

1. **Write the JXA scripts** as static template-string constants. Each script is a
   `function run(argv) { ... }` that:
   - reads its parameters with `JSON.parse(argv[0] || "{}")`
   - returns `JSON.stringify(result)`
2. **Define the tools**: name (`<app>_<action>` in snake_case), a description the
   model can act on, a Zod schema for arguments, and annotations
   (`readOnlyHint` for reads, `destructiveHint` for deletes).
3. **Register the module** in `src/modules/index.ts` — one import, one array entry.
4. Add your tools to the `EXPECTED` list in `scripts/smoke-test.mjs` and to the
   README table.

### Rules that keep this codebase safe and fast

- **Never interpolate user input into a JXA script string.** All dynamic values go
  through the JSON `argv` parameter. This is the project's core security invariant.
- **Use `whose()` clauses** to filter on the Apple side instead of fetching
  everything and filtering in JS — it's dramatically faster on big libraries.
- **Use bulk property reads** (`collection.name()`, `collection.id()`) instead of
  looping over items and reading properties one by one — each property read is a
  separate Apple event.
- **Always support a `limit`** and return compact JSON; tool output goes into the
  model's context window.
- **Throw helpful errors** that include what's available (e.g. list the folder
  names when a folder isn't found) so the model can self-correct.
- Wrap flaky property reads in `try/catch` — some items (password-protected
  notes, broken syncs) throw on access.

## Testing

`npm test` must pass (build + handshake + tool registration). For behavior
against the real apps, test manually with `npm run inspector` — CI runners
can't grant macOS automation permissions, so real-app tests can't run in CI.

## Pull requests

- Keep PRs focused (one app or one fix).
- Describe what you tested manually and on which macOS version.
