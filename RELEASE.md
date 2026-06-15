# Release Process

This repository releases the AltLLM Portal CLI and the repo-local skill docs together. A release version applies to both surfaces unless a release note explicitly says otherwise.

## Versioning

Use SemVer in `MAJOR.MINOR.PATCH` form and tag releases as `vMAJOR.MINOR.PATCH`.

- `PATCH`: bug fixes, documentation corrections, tests, or skill wording changes that do not add new user-facing behavior.
- `MINOR`: new commands, new options, new skill workflows, or backward-compatible behavior changes.
- `MAJOR`: breaking CLI behavior, removed commands or options, incompatible session or API contract changes, or skill changes that require callers to change an established workflow.

While the package is still `0.x`, use `MINOR` for breaking changes unless maintainers decide to cut `1.0.0`. Call out every breaking change in the release notes.

## Release Checklist

1. Start from the branch that should be released and make sure it includes all intended PRs.
2. Confirm the working tree is clean:

   ```bash
   git status --short
   ```

3. Choose the next version and update `package.json`.
4. Run validation:

   ```bash
   npm install
   npm run typecheck
   npm run build
   npm test
   ```

5. If the release changes a live command, run an end-to-end check against the intended Portal or local environment when practical.
6. Draft release notes as `RELEASE_NOTES.md` with the template below. This file can be temporary unless maintainers want to keep release notes in the repository.
7. Commit the version and release-note preparation changes.
8. Tag and push the release:

   ```bash
   git tag vX.Y.Z
   git push origin HEAD
   git push origin vX.Y.Z
   ```

9. Create the GitHub Release:

   ```bash
   gh release create vX.Y.Z \
     --repo alt-research/altllm-skills \
     --title "vX.Y.Z" \
     --notes-file RELEASE_NOTES.md
   ```

Do not run `npm publish` as part of the default release process unless maintainers explicitly add package publishing instructions.

## Release Notes

Keep release notes user-facing. Mention commands, options, skill workflows, security changes, migration steps, and known operational risks. Avoid listing internal-only refactors unless they explain a visible change.

Use this template:

```markdown
# vX.Y.Z - YYYY-MM-DD

## Summary

- One or two bullets describing the release at a high level.

## Added

- New commands, options, skill workflows, or documentation surfaces.

## Changed

- Backward-compatible behavior changes.

## Fixed

- Bug fixes and compatibility fixes.

## Security

- Token handling, wallet signing, secret input, or auth-related changes.

## Breaking Changes

- Required migration steps or changed behavior. Write "None" when there are none.

## Validation

- `npm install`
- `npm run typecheck`
- `npm run build`
- `npm test`
- Any live end-to-end checks that were run, including target environment.

## Known Issues

- Remaining limitations or rollout risks. Write "None" when there are none.
```

## Post-Release

After publishing the GitHub Release:

1. Confirm the release page points to the expected tag.
2. Confirm issue and PR links in the release notes resolve correctly.
3. Close the release-tracking issue if the release process and notes are complete.
4. Announce the release in the project channel used by maintainers.
