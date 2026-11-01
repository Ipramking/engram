# Publishing `engram-walrus` to NPM

The package source is maintained in `packages/engram-mcp/`.

### Prerequisites
1. Ensure you are signed in with the NPM account that has maintainer rights to `engram-walrus` (e.g. `ifrenzy`):
   ```bash
   npm login
   ```
2. Confirm your identity:
   ```bash
   npm whoami
   # Output should be: ifrenzy
   ```

### Pre-Publish Verification
Run the automated test suite and dry-run pack check:
```bash
# 1. Run unit & stdio tests
node packages/engram-mcp/test.mjs

# 2. Dry-run package archive
cd packages/engram-mcp
npm pack --dry-run
```

### Publish Release
To publish version `0.2.0` to the public registry:
```bash
cd packages/engram-mcp
npm publish --access public
```
Or from project root:
```bash
pnpm publish:mcp
```

### Verification
Confirm the new version is live on NPM:
```bash
npm view engram-walrus version
# Output: 0.2.0
```
