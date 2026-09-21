# ADR-0006：允许无 HTTPS 的企业内网入口

- 状态：Accepted
- 日期：2026-09-21

## 背景

目标企业内网没有 HTTPS。ADR-0004 假定由反向代理提供 TLS，P3 readiness 因而拒绝非本机的 HTTP `AUTH_URL`，使实际内网地址无法通过就绪检查。

## 决策

- `AUTH_URL` 可使用 HTTP 或 HTTPS，不再按主机名强制 HTTPS；地址必须是可解析的 HTTP(S) URL，且不能内嵌账号密码，并应与浏览器实际访问的地址一致。
- 保留 `AUTH_SECRET` 强度、内部 API Key、数据库连通性等 readiness 校验；此变更只放开传输协议，不放开认证或资源授权。
- 无 HTTPS 的部署只限可信企业内网，以网络隔离、访问控制和防火墙限制入口，不得向公网开放。代理应清理并重写 Host/Forwarded 头。密码和会话 Cookie 在 HTTP 链路上不加密，具备 TLS 条件时应启用。

本 ADR 仅修订 ADR-0004 的强制 TLS 入口假设，其他无公网运行依赖和镜像交付决策不变。
