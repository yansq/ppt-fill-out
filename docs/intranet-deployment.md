# amd64 内网部署包

适用环境：单台 x86_64 Linux Docker 主机、Docker Compose v2、可从该主机访问的现有 MySQL 8.0 服务器。部署包由 Web、PPT Service、MySQL 8.0.27 客户端三张 `linux/amd64` 镜像，以及本机测试数据库和文件归档组成。运行时不需要访问公网。

## 1. 文件与前置条件

将整个 `intranet-2026-09-23` 目录复制到内网主机。目录内应有 `images.tar.gz`、`mysql-test-data.sql.gz`、`report-data.tar.gz`、`compose.yaml`、`.env.example`、`db-client.env.example`、三个 `.sh` 脚本、`configure-demo-source.mjs`、`SHA256SUMS` 和本说明。先运行 `sha256sum -c SHA256SUMS`。压缩包含测试用户密码哈希、业务数据和模板，按内部敏感数据保管。

目标 MySQL 中 `report_platform` 与 `report_metrics_demo` 两个库名须尚未使用。导入账号需要创建数据库及表的权限。应用账号需要对 `report_platform` 有常规读写权限，并对 `report_metrics_demo` 有 `SELECT`、`INSERT`、`UPDATE` 权限；指标源可以单独使用另一账号。数据库应允许 Docker 主机到 3306/TCP 的连接。示例数据来自 MySQL 8.0.27；目标建议使用兼容的 MySQL 8.0 版本。

## 2. 导入镜像与数据

在部署目录运行：

```bash
gzip -cd images.tar.gz | docker load
docker image inspect report-platform/report-web:2026-09-23 --format '{{.Os}}/{{.Architecture}}'
docker image inspect report-platform/ppt-service:2026-09-23 --format '{{.Os}}/{{.Architecture}}'
cp db-client.env.example db-client.env
chmod 600 db-client.env
```

编辑 `db-client.env`：填写已有 MySQL 的地址、端口、导入账号及密码；`METRIC_DB_*` 填运行时指标源账号。该文件按 Bash `KEY=value` 语法编写，含空格或特殊字符的密码须用单引号包住。脚本不会将密码写入命令参数或日志。给应用及指标账号授权时，可由 DBA 按实际用户名和来源地址执行：

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON report_platform.* TO 'report_app'@'%';
GRANT SELECT, INSERT, UPDATE ON report_metrics_demo.* TO 'report_metric'@'%';
```

账号创建、密码策略和来源地址限制按内网 MySQL 规范处理。如果应用迁移需要 DDL，另行授予受控迁移账号权限；本部署包已有全部迁移和测试数据，不执行 `prisma migrate deploy`。

```bash
./import-databases.sh
./restore-files.sh
```

导入脚本在两个目标库已存在时拒绝执行，避免覆盖现有数据。导入中断后应先由 DBA 检查并清理这两个新建的测试库，再重试。文件脚本在 `report-data` 卷非空时拒绝覆盖。数据库与文件归档必须配套导入；文件归档包含模板、预览与已生成报告。

## 3. 运行配置与指标源

```bash
cp .env.example .env
chmod 600 .env
```

编辑 `.env`，填入应用账号的 `DATABASE_URL`、浏览器实际访问的 `AUTH_URL` 和 Web 监听地址。URL 中的密码特殊字符需要百分号编码。若有同机反向代理，`WEB_BIND_ADDRESS=127.0.0.1`；若需由其他内网主机直连，设为受控的内网 IP。`AUTH_URL` 必须与浏览器访问地址完全一致。生成并填入三个新密钥：

```bash
openssl rand -base64 48   # AUTH_SECRET
openssl rand -hex 32      # PPT_SERVICE_API_KEY
openssl rand -base64 32   # ENCRYPTION_KEY，必须是 32 字节原值
```

导入数据中的指标源密码由原本机密钥加密。使用新密钥时，先运行下列脚本，把该源的地址、账号和密码改为 `db-client.env` 中的目标值并重新加密：

```bash
./configure-demo-source.sh
docker compose --env-file .env -f compose.yaml config --quiet
docker compose --env-file .env -f compose.yaml up -d --no-build --pull never
docker compose --env-file .env -f compose.yaml ps
curl -fsS http://127.0.0.1:3000/api/health/ready  # 绑定其他地址或端口时相应替换
```

`configure-demo-source.sh` 只更新数据库名为 `report_metrics_demo` 的源。启动后用收集人账号在“数据源”页面执行连接测试，再查看指标月份与填报页面。镜像内的 LibreOffice 和 Noto CJK 字体用于 PPT 预览与导出，Web 和 PPT Service 共用 `report-data` 卷。

## 4. 账号、备份与排错

本包复用本机测试用户及任务；测试密码不适合正式环境。首次内网验证后应重置或禁用测试账号，替换示例指标和模板，再向真实用户开放。当前指标适配器固定读取 `report_metrics_demo.metric_record`，企业真实指标库接入仍需按其表结构开发映射。

查看日志：`docker compose --env-file .env -f compose.yaml logs --tail=200 report-web ppt-service`。Web 的 `/api/health/live` 只反映进程存活，`/api/health/ready` 同时检查数据库；PPT Service 的 `/actuator/health/readiness` 只在容器网络内开放。如果数据库连接失败，先从 Docker 主机检查目标地址与账号的远程授权，再核对 `DATABASE_URL`。如果指标源连接失败，核对 `METRIC_DB_*`、目标账号对 `report_metrics_demo` 的授权及数据源页面连接测试。

升级前同时备份两个 MySQL 库、`report-data` 卷及 `.env` 密钥。数据库和文件必须在同一业务时间点配套恢复；保留 `ENCRYPTION_KEY`，否则现有指标源密码无法解密。升级时先导入新镜像并查看镜像标签及迁移说明，再更新 Compose 镜像标签。当前为单机共享卷部署，不支持多节点同时读写同一卷。
