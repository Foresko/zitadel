# Foresko ZITADEL Fork Maintenance

This repository is a fork of [ZITADEL](https://github.com/zitadel/zitadel) containing Foresko-specific modifications.

## Upstream update policy

The fork is updated only to official ZITADEL releases.

Do **not** merge the latest `upstream/v4.x` branch directly, since it may contain changes that have not yet been included in an official release.

Instead, merge the corresponding upstream release tag.

## Update to a new ZITADEL release

Example: updating the fork to ZITADEL `v4.1.0`.

```bash
# Fetch upstream branches and tags
git fetch upstream --tags

# Inspect the release
git show v4.1.0

# Switch to the Foresko branch
git checkout v4.x

# Merge the exact upstream release
git merge --no-ff v4.1.0

# Resolve conflicts if necessary and test the build

# Push the updated branch
git push origin v4.x
```

## Create a Foresko release

After the merged version has been tested, create a tag for the Foresko build:

```bash
git tag -a v4.1.0+foresko.1 -m "Foresko ZITADEL v4.1.0 build 1"
git push origin v4.1.0+foresko.1
```

Additional Foresko releases based on the same upstream version should increment the build number:

```text
v4.1.0+foresko.1
v4.1.0+foresko.2
v4.1.0+foresko.3
```

When upgrading to the next upstream release:

```text
v4.2.0+foresko.1
```

## Versioning convention

Upstream tags are kept unchanged:

```text
v4.1.0
v4.1.1
v4.2.0
```

Foresko-specific releases use SemVer build metadata:

```text
v4.1.0+foresko.1
```

This makes it clear which official ZITADEL release the Foresko build is based on while avoiding conflicts with upstream tags.
