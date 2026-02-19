# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2](https://github.com/bircni/gitea-vs-extension/compare/v0.0.1..v0.0.2) - 2026-02-19

### Ci

- add GitHub Actions workflow for publishing extension - ([ec72027](https://github.com/bircni/gitea-vs-extension/commit/ec720276d23944b40b8b31c5884d9c96d3609c9e))

## [0.0.1] - 2026-02-19

### Added

- implement extension - ([5d28327](https://github.com/bircni/gitea-vs-extension/commit/5d28327a4d2e2b39236bb411b89f9117c1c90f5c))
- implement review comments feature with Gitea integration - ([285b002](https://github.com/bircni/gitea-vs-extension/commit/285b002bf3a811447f9cab042e2552d8ea5980a0))
- add avatar caching for review comments and enhance Gitea API for binary fetching - ([0202423](https://github.com/bircni/gitea-vs-extension/commit/020242365874ba197ebedffaf0bc4e4e6b354bb5))
- enhance GiteaHttpClient to handle same-origin requests and add tests for authorization headers - ([c99f9e2](https://github.com/bircni/gitea-vs-extension/commit/c99f9e208f50669360957a4539e37e69bc9379a7))
- add release helper script to automate versioning and changelog generation - ([a5bbb7d](https://github.com/bircni/gitea-vs-extension/commit/a5bbb7d970eb35b448a93f4c0ca754ecf1ebb4ad))

### Changed

- **(coverage)** add comprehensive test coverage for Gitea API and related utilities - ([8005829](https://github.com/bircni/gitea-vs-extension/commit/8005829941dbb599f34ae53aaf25d09378a65950))
- enhance code quality and consistency across multiple files - ([176ea14](https://github.com/bircni/gitea-vs-extension/commit/176ea1413753f353ca26093a6a74702e80ba1675))
- remove notification handling from commands and refresh controller - ([d6dba8b](https://github.com/bircni/gitea-vs-extension/commit/d6dba8b9853c0bfd5a3cb160658ed063d8279d2f))
- update extension namespace from 'bircni.gitea-vs-extension' to 'gitea-vs-extension' across the codebase - ([52981f7](https://github.com/bircni/gitea-vs-extension/commit/52981f719054f8674b1e168f1112c894bcd3f6db))
- Cleanup - ([425653e](https://github.com/bircni/gitea-vs-extension/commit/425653e8e851b70cb6e55cefba1fd8e23753877c))

### Fixed

- **(lint)** ignore scripts - ([6d00bf1](https://github.com/bircni/gitea-vs-extension/commit/6d00bf1d83ef7d478e5e39deca4d929e0bbcc28c))
- **(release)** update commands to use yarn instead of npm - ([60bb241](https://github.com/bircni/gitea-vs-extension/commit/60bb2410d6ab687a676ca98629dd5d71ce55beb1))
- address PR review comments - ([f3204b8](https://github.com/bircni/gitea-vs-extension/commit/f3204b86f158014c0f461535b6102682f2bda023))
