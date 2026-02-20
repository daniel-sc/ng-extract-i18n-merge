# AGENTS.md

Guidance for agentic coding assistants working in this repository.

## Scope and intent

- This package provides an Angular builder and schematics for extract+merge i18n XLIFF workflows.
- Primary runtime code lives in `src/`.
- Angular schematics and migrations live in `schematics/`.
- Tests are Jest-based and mostly in `src/**/*.spec.ts` and `schematics/**/*.spec.ts`.

## Repository map

- `src/builder.ts`: entry point for the custom builder.
- `src/merger.ts`: merge logic and fuzzy matching behavior.
- `src/model/translationFileSerialization.ts`: XLIFF 1.2 and 2.0 parse/serialize logic.
- `src/options.ts` and `src/schema.json`: option typing and JSON schema defaults.
- `schematics/ng-add/index.ts`: `ng add` setup logic.
- `schematics/migrations/3_0_0/index.ts`: migration logic for v3 changes.
- `.github/workflows/node.js.yml`: CI matrix and canonical CI steps.

## Environment and prerequisites

- Node.js: `>=20.19.0` (from `package.json` engines).
- Package manager: `npm` (`package-lock.json` present).
- TypeScript in strict mode (`tsconfig.json` has `"strict": true`).

## Install

- Install dependencies: `npm install`

## Build, lint, and test commands

- Build (TypeScript compile to `dist/`): `npm run build`
- Test all suites: `npm test`
- Test with coverage: `npm run test-coverage`

### Running a single test (important)

- Single test file (recommended):
  - `npm test -- --runTestsByPath src/lexUtils.spec.ts --runInBand`
- Single test by name:
  - `npm test -- -t "should parse xlf2" --runInBand`
- Single schematic test file:
  - `npm test -- --runTestsByPath schematics/ng-add/index.spec.ts --runInBand`

### Linting status

- There is currently no dedicated lint script in `package.json`.
- Use `npm run build` as the mandatory static type gate.
- Use `npm test` to enforce behavior and regression safety.
- If a lint script is added later, prefer `npm run lint` and document it here.

## CI parity commands

- CI runs install/build/test coverage across multiple Node and Angular version combinations.
- Local quick parity sequence:
  - `npm install`
  - `npm run build`
  - `npm run test-coverage`

## Code style guidelines

### General formatting

- Follow the existing file style first; do not reformat unrelated code.
- Use 4-space indentation in TypeScript source and tests.
- Use semicolons consistently.
- Prefer single quotes for strings.
- Keep lines readable; wrap long expressions similarly to nearby code.
- Preserve existing whitespace-sensitive XML string fixtures in tests.

### Imports

- Group imports by origin: external packages first, local modules second.
- Keep import lists explicit; avoid wildcard imports unless already used by a file.
- Use named imports for most symbols.
- Keep import ordering stable and predictable within each group.
- For type-only concerns, keep consistency with local file conventions.

### Types and type safety

- Maintain strict typing; avoid introducing `any`.
- Use explicit interfaces/types for domain objects (see `TranslationUnit`, `TranslationFile`).
- Prefer `unknown` + narrowing over `any` when necessary.
- Use `Partial<T>`, `Pick<T>`, and unions where they improve correctness.
- Preserve nullability semantics (`string | null`, `string | undefined`) used by existing APIs.
- Keep public/exported function return types explicit when non-trivial.

### Naming conventions

- `PascalCase` for classes, interfaces, and type aliases.
- `camelCase` for functions, methods, variables, and parameters.
- `UPPER_SNAKE_CASE` for module-level constants.
- Test descriptions use behavior phrasing: `should ...`.
- Keep filenames in existing convention (e.g., `translationFileSerialization.ts`).

### Control flow and data handling

- Favor pure transformations with `map`, `filter`, `reduce` when clear.
- Use object spread to create updated copies instead of mutating shared objects.
- Keep mutation localized when required for performance or API constraints.
- Prefer small helper functions for repeated logic.
- Use `Set`/`Map` for identity and lookup-heavy operations.

### Error handling and logging

- Throw explicit errors for impossible states/invariant violations.
- For expected missing-file scenarios, follow `readFileIfExists` pattern and return `null`.
- Re-throw unexpected errors after narrow checks.
- In builders, return structured `{ success: false, error }` on controlled failure.
- Use `context.logger` in builders/schematics for user-facing logs.
- Use `warn` for recoverable issues and actionable diagnostics.

### File system and path usage

- Use `fs.promises` APIs.
- Prefer Angular devkit path helpers where already used (`join`, `normalize`, `dirname`, `basename`).
- Keep output paths relative behavior consistent with current implementation.
- Clean up test artifacts with `rmSafe` and `try/finally`.

### XLIFF and XML handling

- Preserve round-trip behavior for both XLIFF 1.2 and 2.0.
- Do not remove support for additional/unknown attributes.
- Keep whitespace handling semantics intact (`collapseWhitespace`, `prettyNestedTags`, `trim`).
- Be careful with self-closing target behavior (`selfClosingEmptyTargets`).
- Ensure context line number behavior respects `includeContextLineNumber`.

### Tests

- Add/adjust tests for any change in merge/serialization behavior.
- Keep tests deterministic and file-system isolated.
- Prefer `--runInBand` for local single-file debugging.
- Match existing Jest style: `describe` blocks with focused behavior names.
- For fixture-heavy tests, keep expected XML exact and readable.

### Schematics and migrations

- Keep backward compatibility for workspace config inference.
- Use `updateWorkspace` patterns already present in schematics.
- Warn instead of crash when recoverable project config is missing.
- Keep migration transforms minimal and idempotent.

## Cursor/Copilot rule files

- Checked paths:
  - `.cursorrules`
  - `.cursor/rules/`
  - `.github/copilot-instructions.md`
- No repository-specific Cursor/Copilot instruction files were found.
- If such files are added later, treat them as highest-priority agent instructions.

## Change checklist for agents

- Run `npm run build` after code changes.
- Run targeted Jest tests for touched areas.
- Run full `npm test` for broad or risky changes.
- Update tests together with behavior changes.
- Avoid unrelated refactors in the same change.
