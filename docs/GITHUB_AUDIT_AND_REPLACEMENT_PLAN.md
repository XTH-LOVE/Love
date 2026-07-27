# Love小家 GitHub 方案审计

## 结论

项目当前的核心数据边界是正确的：Supabase Auth、Postgres RLS、Realtime 和私有 Storage 应继续作为后端基础设施。所谓“换成 GitHub 上最好的项目”不应该替换这些官方服务，而是把容易出错的自写基础设施替换为成熟开源库，并保留情侣空间的数据模型。

## 当前模块审计

| 模块 | 当前实现 | 风险 | 目标方案 | 处理顺序 |
| --- | --- | --- | --- | --- |
| 认证与情侣空间 | Supabase Auth + 自定义 RPC | 依赖云端迁移和邮件配置 | 保留 Supabase，补 Zod 校验、错误状态和集成测试 | P0 |
| 相册与时光照片 | 私有 Storage + 自定义签名 URL | 旧图可能是原图，首次加载慢 | 保留私有 Storage；三档变体、后台渐进优化；可选 Nuxt Image/IPX | P0 |
| 上传队列 | 自写 localStorage 队列 | 刷新页面后 File 丢失，无法真正续传 | Uppy + Tus + IndexedDB Golden Retriever | P0 |
| 悄悄话消息 | Supabase Realtime + 自写分页/媒体 | 一处逻辑过度压缩，回归风险高 | 保留 Realtime；拆分消息状态，增加幂等、重连和测试 | P0 |
| 语音/视频通话 | ZEGO Express + 自写信令 | Token、1100001、1102016、设备占用都可能失败 | 短期保留 ZEGO 并修复配置诊断；长期评估 LiveKit，需服务端 Token 和 TURN | P1 |
| 实时位置/地图 | 高德优先、Leaflet 兜底 | 双地图 provider 状态复杂，密钥/域名限制明显 | 中国大陆继续高德；抽象地图适配器；Leaflet 只做离线兜底 | P1 |
| AI | Supabase Edge Function 直连 MiMo | 非流式，超时后用户等待；模型/额度依赖外部配置 | 保留 Edge Function；增加 SSE 流式输出、结构化 JSON、重试和生成记录 | P1 |
| 系统通知 | Capacitor Local Notifications + Web Notification | Web 不是后台推送，Android 还需要 Firebase 配置 | Android 使用 FCM；Web 使用 Web Push + Workbox | P1 |
| PWA 缓存 | 自写 Service Worker | 缓存策略和版本清理需要长期维护 | Workbox generateSW/injectManifest；私有媒体继续独立缓存 | P1 |
| 宠物 | Three.js/Fox.glb + 自写 2D fallback | 资源、动作和性能需要设备分级 | 保留 Three.js；加入 Draco/KTX2、LOD、prefers-reduced-motion | P2 |
| 桌面端 | Electron 手写入口 | 更新、崩溃恢复和资源打包需补齐 | 保留 Electron；加入 electron-updater 和版本签名 | P2 |
| 测试 | 没有单元/端到端测试 | 功能多但每次改动缺少回归证据 | Vitest + Playwright + Supabase 本地集成测试 | P0 |

## 选型依据

以下项目均为成熟开源项目，采用前会锁定兼容版本并先做小范围验证：

- [Uppy](https://github.com/transloadit/uppy)：上传 UI、队列、重试、IndexedDB 恢复；MIT，约 3 万 Stars。
- [tus-js-client](https://github.com/tus/tus-js-client)：Tus 可续传上传客户端；MIT，约 2.6 千 Stars。
- [Workbox](https://github.com/GoogleChrome/workbox)：Service Worker 缓存策略和版本淘汰；MIT，约 1.3 万 Stars。
- [Vitest](https://github.com/vitest-dev/vitest)：与 Vite/Nuxt 兼容的单元测试；MIT，约 1.6 万 Stars。
- [Playwright](https://github.com/microsoft/playwright)：桌面、移动视口和真实交互回归；Apache-2.0，约 9 万 Stars。
- [VueUse](https://github.com/vueuse/vueuse)：浏览器权限、网络、媒体和生命周期工具；MIT，约 2.2 万 Stars。
- [LiveKit JS SDK](https://github.com/livekit/client-sdk-js)：长期通话候选；Apache-2.0，但必须先部署 LiveKit/Token 服务。
- [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js)：通用矢量地图候选；中国地图仍需合法图源和授权，不能直接替代高德。

## 实施顺序

### P0：先把可靠性补齐

1. 执行 `014_media_variants.sql`，确认旧照片后台渐进优化。
2. 用 Uppy/Tus 替换当前上传队列，保留现有 Storage 路径和数据库字段。
3. 拆分 `useMessages.ts`，补实时消息、撤回、已读、媒体失败重试测试。
4. 添加 Vitest/Playwright 基础测试，覆盖登录、相册上传、悄悄话、地图全屏、通话错误提示。

### P1：替换外部服务薄弱环节

1. ZEGO 先做 Token 诊断和双端呼叫回归；只有在服务端 Token/TURN 可部署时才切 LiveKit。
2. AI 改为流式响应和严格 JSON schema，避免长内容等待和页面丢失。
3. Android 接 FCM；Web 接标准 Push，不把前台 Notification 当后台推送。
4. 用 Workbox 管理应用壳缓存，私有媒体保持短期签名和 Cache Storage。

### P2：体验和性能

1. 宠物模型加入 Draco/KTX2、LOD 和动作资源按需加载。
2. Electron 加自动更新、崩溃恢复、版本回滚和签名检查。
3. 处理生产依赖审计和当前 Nuxt/Nitro 的安全告警，升级前先跑完整构建和 Android 同步。

## 当前外部阻塞

- 远程 Supabase 迁移历史与本地目录不一致，`supabase db push --dry-run` 已提示远程存在本地缺失的 003/004/005 版本，因此不能强行推送全部迁移。
- LiveKit、FCM、Web Push 都需要服务端密钥或部署地址，不能只靠前端代码完成。
- 高德地图必须使用已备案域名、Key 和安全密钥；MapLibre 不能绕过图源授权。

## 本次 P0 落地记录

- 已加入 `@uppy/core` 和 `@uppy/golden-retriever`，上传文件会写入 IndexedDB，保留 7 天。
- 相册、时光轴和悄悄话继续使用现有 Tus/Supabase Storage 路径，并在队列任务中写入可序列化的业务 `operation` 元数据。
- 已加入 `npm run test` 的 Vitest 队列持久化单测，以及 `npm run test:e2e` 的桌面/移动端壳层冒烟测试。
- IndexedDB 恢复的是文件本体和队列元数据；业务 runner 是页面内闭包，刷新后不会伪造自动写入数据库。恢复项会在队列面板标记，需回到原业务页面重新提交，避免重复创建相册记录或消息。
- 已抽出 `messageState` 纯函数层，覆盖消息内容归一化、旧图片兼容、Realtime 插入去重、已读更新、未读统计和实时位置数据校验。
- 已加入 ZEGO 诊断层：统一解析 `1100001`、`1102016` 和 `1102026`，校验 Token04/AppID/房间 ID；服务端 Token 暂时不可用时，仅在明确配置开发 AppSign 的情况下使用回退 Token。
- 已将 `zego-token` 部署到 Supabase 项目 `soketalclkibyilenvzv`，当前函数版本为 12；未登录请求返回“请先登录”，说明函数入口和 JWT 校验正常。
- Android 已加入高优先级来电通知、全屏唤起、通知清理和前台服务异常回传；应用被系统完全杀死时的来电仍需要后续接入 FCM，当前不会宣称已实现真正的后台来电唤醒。
- 已接入官方 Capacitor Push Notifications、设备 Token 注册和 `send-call-push` Edge Function；远程函数已部署，但必须执行 `015_push_tokens.sql` 并配置 Firebase `google-services.json` 与 `FIREBASE_SERVICE_ACCOUNT_JSON` 后才会真正发送后台推送。
