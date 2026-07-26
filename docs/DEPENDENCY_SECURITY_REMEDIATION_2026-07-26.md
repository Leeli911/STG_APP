# 依赖安全修复记录（2026-07-26）

## 结论

本轮从 GitHub 默认分支报告的 19 项 Dependabot 安全告警开始。npm 将这些公告聚合为 10 个受影响依赖，其中包含 1 个 Critical、6 个 High 和 3 个 Moderate。

修复后的锁文件执行完整 `npm audit`：

- Critical：0
- High：0
- Moderate：0
- Low：0
- 总计：0

GitHub 上的 Dependabot 告警只有在本安全分支合并到 `main` 并完成重新扫描后才会正式关闭。

## 主要修复

| 范围 | 修复前 | 修复后 |
|---|---:|---:|
| Next.js | 15.5.19 | 15.5.21 |
| Vite | 5.4.21 | 7.3.6 |
| Vitest | 2.1.9 | 3.2.7（清单最低 3.2.6） |
| ESLint | 9.39.4 | 10.8.0 |
| PostCSS | Next 内部 8.4.31 | 8.5.23 |
| Sharp | 0.34.5 | 0.35.0 |
| minimatch | 3.1.5 | 10.2.5 |
| brace-expansion | 1.1.15 / 5.0.6 | 5.0.8 |
| js-yaml | 4.2.0 | 4.3.0 |

同时完成：

- 用 ESLint 10 原生 Flat Config 替代依赖旧插件链的兼容层。
- 保留 TypeScript、Next Core Web Vitals、React Hooks 和未使用变量检查。
- 在根清单建立 Next/PostCSS/Sharp 的安全版本权威，避免 npm workspace 增量锁文件重新引入旧传递依赖。
- 使用与 Next 15.5.21 完全一致的官方 `@next/swc-wasm-nodejs` 构建器，避开当前 macOS x64 原生 SWC 的 SIGBUS。
- 将生成型评测目录加入 `.gitignore`。

## 兼容性取舍

最初尝试 Vite 8 / Vitest 4 时，Vite 8 默认 OXC 转换器不能直接复用项目的现有 TSX 测试配置。最终选择仍然覆盖安全补丁、但迁移面更小的 Vite 7 / Vitest 3。

Next 的 WASM 编译器只影响开发和构建阶段，不进入浏览器运行时代码，也不会产生外部 API 成本。代价是构建可能比原生 SWC 稍慢，并会出现 Next 对测试型 WASM 开关的提示。Next、原生 SWC 与 WASM 包后续必须保持同一版本升级。

## 验收证据

- `npm audit`：0 项漏洞
- `npm run lint`：通过
- `npm run typecheck`：通过
- `npm test`：28 个文件、291 项测试通过
- `npm run build:demo`：通过
- `npm run build`：通过，27 个路由完成生成
- `npm run test:e2e`：桌面/移动端 6 项通过
- `npm ls`：Next 只解析到 PostCSS 8.5.23 与 Sharp 0.35.0

## 后续守卫

- 每次 Dependabot 或 npm 安全数据库更新后重新执行完整 `npm audit`，不能只运行 `--omit=dev`。
- 框架、编译器和 WASM 包作为一组升级。
- 安全 PR 合并后复核 GitHub Security 页，确认历史告警已关闭且没有新告警。
- 若未来 Next 稳定版本的原生 SWC 在 Node 22/macOS x64 上恢复稳定，可通过单独 PR 移除 WASM 回退。
