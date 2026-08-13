# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.3](https://github.com/bircni/gitea-vs-extension/compare/v0.4.2..v0.4.3) - 2026-08-13

### Fixed

- **(api)** parse Actions list responses as arrays ([#46](https://github.com/bircni/gitea-vs-extension/issues/46)) - ([1da6449](https://github.com/bircni/gitea-vs-extension/commit/1da6449028f5100470448a0b75e39f4374e2f5f3))

## [0.4.2](https://github.com/bircni/gitea-vs-extension/compare/v0.4.1..v0.4.2) - 2026-08-02

### Changed

- cleanup (agent leak, dead code) ([#38](https://github.com/bircni/gitea-vs-extension/issues/38)) - ([f00ce88](https://github.com/bircni/gitea-vs-extension/commit/f00ce885b75c93831b894c0a6b430322c7b82d88))

### Fixed

- **(refresh)** preserve repository state and refresh filters ([#39](https://github.com/bircni/gitea-vs-extension/issues/39)) - ([98e4751](https://github.com/bircni/gitea-vs-extension/commit/98e47513c09c652a2733b0f05905b7e85c61812d))

## [0.4.1](https://github.com/bircni/gitea-vs-extension/compare/v0.4.0..v0.4.1) - 2026-06-19

### Fixed

- **(runs)** fetch current-branch runs server-side and flatten single repo - ([0bcc1f4](https://github.com/bircni/gitea-vs-extension/commit/0bcc1f475c2420e89fdf81ff7c6173540f5c2dfe))

## [0.4.0](https://github.com/bircni/gitea-vs-extension/compare/v0.3.0..v0.4.0) - 2026-06-14

### Added

- **(commands)** add checkout PR branch command ([#15](https://github.com/bircni/gitea-vs-extension/issues/15)) - ([8afdffa](https://github.com/bircni/gitea-vs-extension/commit/8afdffa71a718cdf0c55011aa3230205767fd988))

### Internal

- **(lint)** enable eslint unicorn ([#35](https://github.com/bircni/gitea-vs-extension/issues/35)) - ([b27fcb2](https://github.com/bircni/gitea-vs-extension/commit/b27fcb2e9f01d450f6a1b3ab9d1ee784bc8fe513))
- Update swagger - ([9b560d7](https://github.com/bircni/gitea-vs-extension/commit/9b560d7efb2995abd02a49d43a20aacc12edf5f2))

## [0.3.0](https://github.com/bircni/gitea-vs-extension/compare/v0.2.1..v0.3.0) - 2026-05-03

### Added

- **(review)** add editor review comment command - ([6e50621](https://github.com/bircni/gitea-vs-extension/commit/6e506210613f8e0e6060807eee13074c1879f858))

### Internal

- **(review)** Add E2E tests with Gitea fixture - ([4f70fbb](https://github.com/bircni/gitea-vs-extension/commit/4f70fbb10081ec30174407cf8f18aa03012d482a))
- Update dependencies - ([524da01](https://github.com/bircni/gitea-vs-extension/commit/524da0181468ba50f9f8d190c9ccc7ea94b1dddd))
- Migrate to vitest - ([12d14c4](https://github.com/bircni/gitea-vs-extension/commit/12d14c4b290aba49047f91bceff39d621681515c))

## [0.2.1](https://github.com/bircni/gitea-vs-extension/compare/v0.2.0..v0.2.1) - 2026-04-02

### Fixed

- **(review-comments)** avoid flicker on refresh with stable fingerprint - ([c750496](https://github.com/bircni/gitea-vs-extension/commit/c7504962cb91016a74b0cc2f2cc88b0f28dd6b41))
- enhance avatar handling and sorting logic - ([90e2873](https://github.com/bircni/gitea-vs-extension/commit/90e2873a6a5f418c24b3dcd6419aeb02d3afdceb))
- include avatar URL in fingerprint generation and add related tests - ([3e6037c](https://github.com/bircni/gitea-vs-extension/commit/3e6037c72abdccf46e578bd1e92956b8efb31b84))

### Internal

- **(audit)** Update dependencies - ([bf85d8b](https://github.com/bircni/gitea-vs-extension/commit/bf85d8b95f5d844845f6f62eea5cb6f27cb09894))
- **(scripts)** add update:swagger and refresh Gitea OpenAPI snapshot - ([ab068bd](https://github.com/bircni/gitea-vs-extension/commit/ab068bda49b61eafe855b325c9f3a48e61f002ee))
- Cleanup and update dependencies - ([bd49b8e](https://github.com/bircni/gitea-vs-extension/commit/bd49b8e8d009ec9f91629cb489d0765de284ede0))
- hermetic Gitea mock, live smoke, and extension E2E - ([56d60e4](https://github.com/bircni/gitea-vs-extension/commit/56d60e47d5e4cabca45cf4068ced867e28c691f5))
- Enhance Changelog generation - ([4dab1c3](https://github.com/bircni/gitea-vs-extension/commit/4dab1c315a670be78775034cf710b66c970bc542))
- minor enhancements - ([cd57d0c](https://github.com/bircni/gitea-vs-extension/commit/cd57d0ca65c2df27f397464d4a0e39af6a75812f))
- Various fixes for Windows - ([c0120f5](https://github.com/bircni/gitea-vs-extension/commit/c0120f5b2796910ab1e89c5f3adffa32f5b1ec83))

## [0.2.0](https://github.com/bircni/gitea-vs-extension/compare/v0.1.0..v0.2.0) - 2026-03-15

### Added

- **(artifacts)** add download for workflow artifacts ([#12](https://github.com/bircni/gitea-vs-extension/issues/12)) - ([bc045b9](https://github.com/bircni/gitea-vs-extension/commit/bc045b98a5b99f03fd62f19db05411ea5adcef47))

### Changed

- **(issues)** add issue drafts for §3 #7, #10 and §4 structural improvements - ([e0897e0](https://github.com/bircni/gitea-vs-extension/commit/e0897e0f679277195098768d0a47603424978604))
- add roadmap analysis and issue drafts for high-priority features - ([813b3e5](https://github.com/bircni/gitea-vs-extension/commit/813b3e5ca83a1508815b9dfb3a7d45f58831d1a8))
- refactor orchestration and raise test coverage ([#21](https://github.com/bircni/gitea-vs-extension/issues/21)) - ([14969b7](https://github.com/bircni/gitea-vs-extension/commit/14969b75593dfa3e5fcdc235d1d38842f21720aa))

## [0.1.0](https://github.com/bircni/gitea-vs-extension/compare/v0.0.2..v0.1.0) - 2026-03-14

### Added

- auto-save job logs to repo at .tmp/gitea-logs/run-<id>-job-<id>.log - ([08f5d31](https://github.com/bircni/gitea-vs-extension/commit/08f5d314295471c8346080c36b451c86a1e8a5e0))
- current branch workflows view and branch filter - ([84b6f51](https://github.com/bircni/gitea-vs-extension/commit/84b6f515d8bd145a91d5be2fdb527f7172fb649d))

### Changed

- Add speckit - ([997e7cf](https://github.com/bircni/gitea-vs-extension/commit/997e7cf7622b73b5b451fb58d9d78ee68c6b6f17))

### Internal

- update .vscodeignore for packaging - ([ccbbe83](https://github.com/bircni/gitea-vs-extension/commit/ccbbe8318cd014f50593b8404b13288370a64479))
- fix npm audit by overriding vulnerable yauzl - ([5738edd](https://github.com/bircni/gitea-vs-extension/commit/5738edd754702007b9283dc1d8531b2134025863))
- Update release log generation - ([4295577](https://github.com/bircni/gitea-vs-extension/commit/42955775f00a18f18f2f239c666797261846ad69))

## [0.0.1] - 2026-02-19

### Added

- implement extension - ([5d28327](https://github.com/bircni/gitea-vs-extension/commit/5d28327a4d2e2b39236bb411b89f9117c1c90f5c))
- implement review comments feature with Gitea integration - ([285b002](https://github.com/bircni/gitea-vs-extension/commit/285b002bf3a811447f9cab042e2552d8ea5980a0))
- add avatar caching for review comments and enhance Gitea API for binary fetching - ([0202423](https://github.com/bircni/gitea-vs-extension/commit/020242365874ba197ebedffaf0bc4e4e6b354bb5))
- enhance GiteaHttpClient to handle same-origin requests and add tests for authorization headers - ([c99f9e2](https://github.com/bircni/gitea-vs-extension/commit/c99f9e208f50669360957a4539e37e69bc9379a7))
- add release helper script to automate versioning and changelog generation - ([a5bbb7d](https://github.com/bircni/gitea-vs-extension/commit/a5bbb7d970eb35b448a93f4c0ca754ecf1ebb4ad))

### Changed

- enhance code quality and consistency across multiple files - ([176ea14](https://github.com/bircni/gitea-vs-extension/commit/176ea1413753f353ca26093a6a74702e80ba1675))
- remove notification handling from commands and refresh controller - ([d6dba8b](https://github.com/bircni/gitea-vs-extension/commit/d6dba8b9853c0bfd5a3cb160658ed063d8279d2f))
- update extension namespace from 'bircni.gitea-vs-extension' to 'gitea-vs-extension' across the codebase - ([52981f7](https://github.com/bircni/gitea-vs-extension/commit/52981f719054f8674b1e168f1112c894bcd3f6db))
- Cleanup - ([425653e](https://github.com/bircni/gitea-vs-extension/commit/425653e8e851b70cb6e55cefba1fd8e23753877c))

### Fixed

- **(lint)** ignore scripts - ([6d00bf1](https://github.com/bircni/gitea-vs-extension/commit/6d00bf1d83ef7d478e5e39deca4d929e0bbcc28c))
- **(release)** update commands to use yarn instead of npm - ([60bb241](https://github.com/bircni/gitea-vs-extension/commit/60bb2410d6ab687a676ca98629dd5d71ce55beb1))
- address PR review comments - ([f3204b8](https://github.com/bircni/gitea-vs-extension/commit/f3204b86f158014c0f461535b6102682f2bda023))

### Internal

- **(coverage)** add comprehensive test coverage for Gitea API and related utilities - ([8005829](https://github.com/bircni/gitea-vs-extension/commit/8005829941dbb599f34ae53aaf25d09378a65950))
