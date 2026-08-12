## [1.0.46](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.45...v1.0.46) (2026-08-12)


### Features

* add support for Date objects in family arguments and provide detailed error paths for validation failures ([71c4cb2](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/71c4cb2b6f872f8764e8853b000dfe6ee99e6884))

## [1.0.45](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.44...v1.0.45) (2026-08-11)


### Features

* enable support for undefined values in providerFamily arguments ([7cd9b5d](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/7cd9b5d362f13ae14a1652d253e293e67e8c43a3))

## [1.0.44](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.43...v1.0.44) (2026-08-10)


### Features

* enhance DevTools UI with rapid event grouping, improved layout styling, and integrated copy functionality for provider details. ([a49f7da](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/a49f7dabcacde4e721d1b88e04bed0ca1c3d4693))

## [1.0.43](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.42...v1.0.43) (2026-08-10)


### Bug Fixes

* harden provider state lifecycle ([a7be01b](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/a7be01b30c4c5fca04a6a2405be57d98cdeacd1a))

## [1.0.42](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.41...v1.0.42) (2026-08-06)


### Features

* add StreamProvider for consuming synchronous and asynchronous iterables ([669f77c](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/669f77c9b2e5229c382d1eaebc7335e148abe6bf))

## [1.0.41](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.40...v1.0.41) (2026-07-09)


### Bug Fixes

* abort mutation on onMutate error, improve container cleanup and promise validation, and update library build formats. ([987e03a](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/987e03a9c956698944c369c8d43d57e35036c6bf))

## [1.0.40](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.39...v1.0.40) (2026-07-07)


### Features

* add support for invalidating entire provider families via container and ref API ([7314b48](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/7314b482313eb6fbef79474bca52f69c7f2ff44a))

## [1.0.39](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.38...v1.0.39) (2026-07-03)


### Bug Fixes

* ensure notifierAccessor updates when parent notifier provider is invalidated ([7319665](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/7319665c8e55183dfbfed4abbdb81e0a71521499))

## [1.0.38](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.37...v1.0.38) (2026-06-11)


### Features

* enable key-order independent caching for object arguments in providerFamily ([5ff1734](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/5ff1734d46d2c00692a0bf7973f5e3f7bd4b0de2))

## [1.0.37](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.36...v1.0.37) (2026-06-08)


### Features

* maintain previous data in loading state during provider refreshes ([a4bda0f](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/a4bda0fd2e91b25e8f2d17b7228d2d13d090ef67))

## [1.0.36](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.35...v1.0.36) (2026-06-03)


### Features

* add console.error logging for provider exceptions and suppress logs in test environment ([188133c](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/188133c167ddd467199ca8f2f4057a36d8685134))

## [1.0.35](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.34...v1.0.35) (2026-05-14)


### Features

* add optional custom equality check to stateProvider for change tracking optimization ([db0aee2](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/db0aee2e82e3cdcf8065d1c74d64b67f5a78d78e))

## [1.0.34](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.33...v1.0.34) (2026-05-13)


### Performance Improvements

* suppress redundant serialization warnings for individual providers using a memoization set ([f7f81b3](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/f7f81b37d6e741fa397a3e9e937c573967fdb2f1))

## [1.0.33](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.32...v1.0.33) (2026-05-12)

## [1.0.32](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.31...v1.0.32) (2026-05-12)


### Bug Fixes

* update useRiverWatch selector cache to include selector reference for stale state resolution ([1d77913](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/1d77913ef3eaebfc92e680b7b97d409327cd7dbc))


### Features

* add support for optional selector and conditional enabled state to useRiverWatch hook ([1b0c451](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/1b0c4514c2db3e9b2b36b02986b336ee9e207079))

## [1.0.31](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.30...v1.0.31) (2026-05-09)


### Features

* ensure provider factories execute during hydration to correctly establish dependency graphs ([e9f7d90](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/e9f7d90f8dbbd9243abd7d2f671487863fd3ad57))
* **SSR:** support ssr ([a6356c3](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/a6356c3f1631e6cf69edd3768c0554b0c0e9334b))

## [1.0.30](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.29...v1.0.30) (2026-05-07)

## [1.0.29](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.28...v1.0.29) (2026-05-05)


### Features

* add configurable cache policy to RiverContainer with scope-based default overrides ([4e5eacd](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/4e5eacd25dbb7ff65bf33e15bad23813fb8ac219))

## [1.0.28](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.27...v1.0.28) (2026-05-05)


### Features

* **useRiverMutation:** add useRiverMutation hook for imperative async operations with local state tracking ([46461c6](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/46461c618b838a31a400e2e00c01bd1d14dc13a1))

## [1.0.27](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.26...v1.0.27) (2026-04-23)

## [1.0.26](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.25...v1.0.26) (2026-04-21)

## [1.0.25](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.24...v1.0.25) (2026-04-21)


### Bug Fixes

* enable overrides for notifierProvider and asyncNotifierProvider in RiverContainer ([e42da96](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/e42da9649a329debe918d1ade98ae4e7a1503614))

## [1.0.24](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.23...v1.0.24) (2026-04-17)

## [1.0.23](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.22...v1.0.23) (2026-04-17)


### Features

* add family snapshot grouping, graph panning/zooming, and argument display to devtools ([4a936d6](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/4a936d67c26deb7b7c74a693eda4bc5630dbe47e))

## [1.0.22](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.21...v1.0.22) (2026-04-15)


### Performance Improvements

* **Devtools:** memery usage ([74d9d13](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/74d9d135e82cc6186675b3823a157e95e7022211))

## [1.0.21](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.20...v1.0.21) (2026-04-14)

## [1.0.20](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.19...v1.0.20) (2026-04-14)


### Features

* add unit test ([eda4a5e](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/eda4a5e8897b57fe24b6f6e5c1acb0fa919669e6))
* integrate Vitest with React Testing Library and configure CI coverage reporting ([3127975](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/31279754dba936902f687097356dad2c00ecef6d))

## [1.0.19](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.18...v1.0.19) (2026-04-10)

## [1.0.18](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.17...v1.0.18) (2026-04-09)


### Bug Fixes

* remove .npmrc ([810662f](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/810662f6acd875a5a52a0de94213acef135aa5ea))

## [1.0.17](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.16...v1.0.17) (2026-04-09)

## [1.0.16](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.15...v1.0.16) (2026-04-09)


### Features

* initialize maxEvents from pinned devtools and update default limit to 100 ([1da9560](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/1da9560fae744ae3364be77ea42a733b29b9ce64))

## [1.0.15](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.14...v1.0.15) (2026-04-09)

## [1.0.14](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.13...v1.0.14) (2026-04-09)

## [1.0.13](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.12...v1.0.13) (2026-04-09)


### Features

* implement global provider support and add ScopedCounterCard example for testing provider isolation ([02bb078](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/02bb078bad1961f4826da03f35076681999fc706))

## [1.0.12](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.11...v1.0.12) (2026-04-08)


### Features

* **DevTool:** hide UI on prod ([0b96156](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/0b96156f41f5516d8bc8e5e962a0e7906a6303bb))

## [1.0.11](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.10...v1.0.11) (2026-04-08)

## [1.0.10](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.9...v1.0.10) (2026-04-08)

## [1.0.9](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.8...v1.0.9) (2026-04-08)

## [1.0.8](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.7...v1.0.8) (2026-04-08)


### Reverts

* Revert "test" ([9f96988](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/9f9698892acaf9df77d0dac0a0e77550b58beb01))

## [1.0.7](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.6...v1.0.7) (2026-04-08)


### Features

* update observable subscribe signature to support both function and object callbacks ([ad5e88f](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/ad5e88f739c6c9b10dc1875055b46efae6896043))

## [1.0.6](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.5...v1.0.6) (2026-04-08)

## [1.0.5](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.4...v1.0.5) (2026-04-08)

## [1.0.4](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.3...v1.0.4) (2026-04-08)


### Bug Fixes

* token ([d100fcb](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/d100fcb2f15e183e4df726306791156b2ed29a98))

## [1.0.3](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.2...v1.0.3) (2026-04-08)

## [1.0.2](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.1...v1.0.2) (2026-04-08)


### Bug Fixes

* retry npm publish ([ca1ab3e](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/ca1ab3e3ff730d84193fbd3f0a81f66ce07de260))

## [1.0.1](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/compare/v1.0.0...v1.0.1) (2026-04-08)

# 1.0.0 (2026-04-08)


### Bug Fixes

* promiseAccessor catch parentState ([f03252e](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/f03252e4c0ab448369c3dde80e5e2e55ecf578c5))


### Features

* add event expansion details, event search, and provider sorting to devtools ([c6c7b5c](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/c6c7b5ce9aba7429b30e77249e083d4297027bd0))
* add PromiseAccessor to expose provider state as a promise and integrate into core providers ([36efd0e](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/36efd0e2b472e34014d904ce46d5a99420f00630))
* add selector support to watch() for granular dependency tracking and update devtools sorting UI ([19e6d24](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/19e6d24be17a553df95b946f2551a62c43508a4a))
* implement cacheTime support for delayed auto-disposal of providers ([f4c70a0](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/f4c70a0d92a8565eded837e175691b37e1fe1075))
* implement comprehensive example application showcasing react-river provider patterns and components ([21689c4](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/21689c42bf99771584a58d9b402a93e506908def))
* implement interactive devtools panel for monitoring provider states and dependency graphs ([dfc332b](https://gitlab.com/zerologix/logixintelligent/logixtrader/react-river/commit/dfc332b9367f1c5f0dc124f7cccefc5b4ff76d68))
