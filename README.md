<p align="center">
  <img src="public/couplespace-mark.svg" width="108" alt="Love小家 logo">
</p>

<h1 align="center">Love小家 · CoupleSpace</h1>

<p align="center">
  一个真正属于两个人的私密生活空间。<br>
  把照片、视频、悄悄话、纪念日、AI 灵感和共同宠物，认真收藏在一起。
</p>

<p align="center">
  <a href="https://github.com/XTH-LOVE/Love-"><img src="https://img.shields.io/github/stars/XTH-LOVE/Love-?style=for-the-badge&color=ff6fae&label=Stars" alt="GitHub stars"></a>
  <a href="https://github.com/XTH-LOVE/Love-/network/members"><img src="https://img.shields.io/github/forks/XTH-LOVE/Love-?style=for-the-badge&color=9c6ade&label=Forks" alt="GitHub forks"></a>
  <a href="https://github.com/XTH-LOVE/Love-/blob/HEAD/LICENSE"><img src="https://img.shields.io/github/license/XTH-LOVE/Love-?style=for-the-badge&color=7eb8e8" alt="MIT license"></a>
  <a href="https://love-home.pages.dev/"><img src="https://img.shields.io/badge/Live%20Demo-love--home.pages.dev-f4a1c5?style=for-the-badge" alt="Live demo"></a>
</p>

<p align="center">
  <a href="#为什么做-love小家">为什么做</a> ·
  <a href="#功能一览">功能一览</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#构建与发布">部署</a> ·
  <a href="#参与贡献">参与贡献</a>
</p>

<p align="center">
  <img src="public/login-couple.jpg" width="820" alt="Love小家登录页预览">
</p>

## 为什么做 Love小家

很多情侣应用只提供一个聊天框，或者把纪念日、相册和日记拆散在不同产品里。Love小家想做的是一个更完整、更有温度的双人空间：

- 不是公开社交网络，而是只属于同一情侣空间成员的私密房间。
- 不是一次性发完就消失的聊天，而是可以回看的共同记忆库。
- 不是冷冰冰的工具集合，而是有开屏、品牌、情绪化视觉和共同宠物的长期陪伴产品。
- 不是只停留在网页的 Demo，而是同时面向 Web、Android 和 Windows 桌面端设计。

Love小家使用淡紫、淡粉、白色和玻璃质感作为视觉基调，把“记录日常”做成一种轻松、浪漫、愿意每天打开的习惯。

## English overview

**Love小家 (CoupleSpace)** is a private, realtime space for two people. It combines shared memories, albums, private messages, anniversaries, AI-assisted writing, location sharing, realtime calls and a growing virtual pet system in one calm, romantic interface.

It is built with Nuxt 4, Vue 3, TypeScript and Supabase, and can be shipped as a static web app, an Android application through Capacitor, or a Windows desktop app through Electron. The repository is intentionally self-hostable: authentication, database policies, storage, realtime channels and server-side secrets are documented so developers can build their own private couple space instead of relying on a public social network.

The project is still evolving. Contributions are welcome, especially around accessibility, offline media, better pet interactions, testing and platform polish.

## 功能一览

### 首页：你们的共同入口

- 实时显示在一起的天、时、分、秒。
- 支持选择共同封面，并根据照片比例自动适配展示区域。
- 最近共同回忆最多展示 10 项，支持照片和视频预览。
- 今日情话轮播、共同计划、下一个纪念日和情书入口集中在首页。
- 首页展示悄悄话未读角标和系统通知入口。
- 支持开屏动画、一次性软件声明、版本更新提示和关于软件页面。

### 时光轴：把故事写下来

- 按日期记录文字、地点、照片和视频。
- 支持编辑、删除和回看已经保存的共同回忆。
- 每条内容显示记录日期、地点和上传成员。
- 适合记录第一次旅行、生日、见面、纪念日和普通但值得记住的一天。

### 相册：照片和视频分开管理

- 创建多个相册，按相册、照片、视频和时光轴来源筛选。
- 支持一次选择多张照片或多个视频上传。
- 图片上传前进行客户端压缩，减少手机端等待时间。
- 图片和视频支持预览、全屏查看、下载和删除。
- 每项媒体显示拍摄日期和添加者。
- 使用签名地址、浏览器缓存和分批加载，避免每次打开都重新等待全部媒体。

### 悄悄话：双人实时消息

- 文字消息、照片、短视频、语音和表情表达。
- 消息按时间展示，并显示发送状态、已读状态和发送者头像。
- 打开聊天后自动标记已读，自动滚动到最新消息。
- Enter 快速发送，手机端使用全屏聊天布局。
- 支持撤回自己发送的消息和媒体。
- 支持发送当前位置、共享实时位置、真实地图查看、放大缩小和全屏地图。
- 支持语音通话、视频通话以及无需接听即可收听的开麦模式。
- 支持系统级通知、来电提示和网络重连。

> 通话、系统通知、实时位置和地图需要浏览器/系统权限以及对应的 Supabase、ZEGO 或地图服务配置。未配置外部服务时，核心页面仍可启动并用于本地演示。

### 纪念日：重要日子不再错过

- 设置在一起的日期，并实时计算共同经历的时间。
- 创建可重复的纪念日、旅行日、生日和自定义日期。
- 显示下一个即将到来的特别日子和剩余天数。

### 清单：一起完成的小事

- 创建共同计划、备注、分类、优先级和计划日期。
- 任意一方完成后，另一方可以实时看到状态变化。
- 首页显示待完成事项和完成进度。

### 心动 AI：让 AI 帮你写得更像你们

- AI 约会策划：根据城市、预算和偏好生成约会方案。
- AI 日记：根据当天真实素材生成可保存的共同日记。
- AI 情书：选择收件人、字数和语气，生成后保存为长期作品。
- 生成结果可以展开全文，切换页面后仍可从历史记录中打开。
- 使用 Supabase Edge Function 代理小米 MiMo 请求，API Key 不放进前端。
- 服务端包含请求长度限制、频率限制和错误提示，避免把 AI 生成变成不可控的黑盒。

### 宠物小屋：一起养一只属于你们的宠物

- 支持不同宠物种类、皮肤、配饰和 3D Fox 模型。
- 宠物拥有喂养、互动、成长和进化机制。
- 共同互动可以积累续火花天数。
- 支持宠物小屋、家具扩展和专属动作的持续开发。

## 视觉与交互

- 桌面端：浮动玻璃侧边栏，适合宽屏持续使用。
- 手机端：浮动底部导航，避开状态栏和系统导航区域。
- 大圆角、半透明表面、淡紫淡粉渐变和柔和阴影。
- 使用 Manrope 与 Nunito Sans，兼顾英文产品信息和中文界面阅读。
- 使用 Lucide 图标，按钮保留清晰的图标、状态和无障碍标签。
- 上传、加载、失败重试、空状态和移动端安全区均有独立处理。

## 技术栈

| 层级 | 技术 | 用途 |
| --- | --- | --- |
| Web 应用 | Nuxt 4、Vue 3、TypeScript | SSR、静态生成和组件化界面 |
| 样式与交互 | CSS、玻璃质感设计、Lucide | 响应式布局、主题和图标系统 |
| 用户与数据 | Supabase Auth、Postgres、RLS | 登录、情侣空间、数据隔离和权限控制 |
| 实时能力 | Supabase Realtime | 消息、情书、宠物和共同数据同步 |
| 私密媒体 | Supabase Storage | 照片、视频、语音和短期签名地址 |
| 服务端能力 | Supabase Edge Functions | AI 请求代理、ZEGO Token、敏感逻辑隔离 |
| AI | 小米 MiMo | 约会策划、共同日记和情书生成 |
| 通话 | ZEGO Express | 音频通话、视频通话和开麦模式 |
| 地图 | Leaflet / 高德地图配置 | 位置消息、实时位置和地图展示 |
| 3D | Three.js、GLB 模型 | 宠物模型、动作和进化展示 |
| 移动端 | Capacitor Android | Android APK 构建和系统能力接入 |
| 桌面端 | Electron | Windows 桌面软件和自动加载线上版本 |

## 项目结构

```text
CoupleSpace/
├─ app/
│  ├─ app.vue                 # 应用壳、导航、首页和全局状态
│  ├─ components/             # 首页、相册、时光、聊天、AI、宠物等界面
│  ├─ composables/            # Auth、Realtime、媒体缓存、通话和业务逻辑
│  └─ plugins/supabase.ts     # Supabase 客户端初始化
├─ public/
│  ├─ couplespace-mark.svg    # 品牌图标
│  ├─ login-couple.jpg        # 登录页视觉资源
│  └─ models/Fox.glb          # 3D 宠物模型
├─ supabase/
│  ├─ migrations/             # 数据表、RLS、Realtime 和宠物系统迁移
│  └─ functions/              # AI、ZEGO Token、账户相关 Edge Functions
├─ android/                   # Capacitor Android 工程
├─ desktop/                   # Electron Windows 桌面壳
├─ infra/                     # 可选通话基础设施配置
├─ capacitor.config.json
├─ nuxt.config.ts
└─ package.json
```

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/XTH-LOVE/Love-.git
cd Love-
npm install
```

Windows PowerShell：

```powershell
git clone https://github.com/XTH-LOVE/Love-.git
Set-Location Love-
npm install
Copy-Item .env.example .env
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，至少配置：

```env
NUXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

可选能力：

- `NUXT_PUBLIC_AMAP_KEY`：高德地图 Web 端 Key。
- `NUXT_PUBLIC_AMAP_SECURITY_CODE`：高德安全密钥。
- `NUXT_PUBLIC_ZEGO_APP_ID`：ZEGO App ID。
- `NUXT_PUBLIC_ZEGO_SERVER`：ZEGO WebSocket 服务地址。
- `NUXT_PUBLIC_TURN_URLS`、`NUXT_PUBLIC_TURN_USERNAME`、`NUXT_PUBLIC_TURN_CREDENTIAL`：WebRTC 中继配置。

### 3. 初始化 Supabase

将 `supabase/migrations/` 中的迁移应用到自己的 Supabase 项目。使用 Supabase CLI 时可以：

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push
```

再部署 Edge Functions：

```bash
npx supabase functions deploy account-auth
npx supabase functions deploy heart-ai
npx supabase functions deploy zego-token
```

Edge Function Secrets 应在 Supabase 控制台配置：

- `MIMO_API_KEY`
- `MIMO_BASE_URL`（可选）
- `MIMO_MODEL`（默认使用项目配置的 MiMo 模型）
- `ZEGO_SERVER_SECRET`

这些值只应该存在于服务端 Secrets 中，不要写进 `.env`、README、前端代码或提交记录。

### 4. 启动开发环境

```bash
npm run dev
```

默认开发地址通常是 `http://127.0.0.1:3200/`。如果 3200 端口已被占用，Nuxt 会选择其他端口。

## 构建与发布

### Web 静态站点

```bash
npm run generate
```

生成结果位于 `.output/public/`，可部署到 Cloudflare Pages、Netlify、Vercel 静态托管或任意静态服务器。

### Android APK

```bash
npm run android:apk
```

该命令会先生成静态网页、同步 Capacitor 工程，再构建 Debug APK。正式发布前请在 Android Studio 中配置签名和 Release 构建。

### Windows 桌面软件

```bash
npm run desktop:dev
npm run desktop:exe
```

Electron 桌面壳默认加载线上 Web 版本，因此网页业务更新不一定需要重新制作 EXE。安装包输出到 `desktop-dist/`。

### 版本更新

版本号维护在 `package.json` 和 Nuxt runtime config 中。网页和桌面端使用在线更新清单，Android 通过 APK 下载入口提示用户安装新版本。完整流程见 [APP_UPDATE.md](APP_UPDATE.md)。

## 安全与隐私设计

Love小家处理的是情侣之间的照片、视频、消息和位置，因此安全边界不是附加功能，而是核心设计：

- 每个用户属于一个情侣空间，业务查询以 `couple_id` 为边界。
- Supabase Postgres 使用 RLS 限制同一情侣空间之外的访问。
- 私密媒体使用 Storage 签名地址，不把公开永久文件 URL 作为主要访问方式。
- 前端只使用 Supabase anon key；service role key、ZEGO ServerSecret、AI Key 只允许放在服务端。
- AI 请求通过 Edge Function 转发，避免在浏览器暴露供应商密钥。
- 账户设置中不会显示用户密码，只提供修改或重置能力。
- 生产环境必须使用 HTTPS，并按实际部署域名配置认证回调地址。

## 当前状态

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| Web 登录与情侣空间 | ✅ 可用 | 需要配置 Supabase Auth 和数据库 |
| 首页、相册、时光、纪念日、清单 | ✅ 可用 | 支持真实数据和演示模式 |
| 双人实时文字与媒体消息 | ✅ 可用 | 需要消息表、Storage 和 Realtime |
| AI 约会、日记、情书 | ✅ 可用 | 需要部署 `heart-ai` 并配置 MiMo Secrets |
| 真实地图与位置分享 | 🧪 配置后可用 | 需要地图 Key、域名白名单和定位权限 |
| 音频/视频通话 | 🧪 配置后可用 | 需要 ZEGO ServerSecret、浏览器媒体权限 |
| 3D 宠物与成长系统 | 🚧 持续完善 | 当前已接入模型、皮肤、配饰和互动基础 |
| Android / Windows 发布 | ✅ 可构建 | 正式发布需要各平台签名和商店配置 |

## 路线图

- [ ] 更丰富的 3D 宠物模型、家具和动作系统。
- [ ] 共同宠物的成长阶段、任务和奖励。
- [ ] 更完整的系统级来电、通知和后台音频体验。
- [ ] 媒体上传断点续传、离线队列和更智能的本地缓存。
- [ ] PWA 安装体验、桌面通知和跨设备同步优化。
- [ ] 多语言界面与更完善的无障碍支持。
- [ ] 面向贡献者的组件文档和端到端测试。

## 贡献指南

欢迎提交 Issue、改进建议、UI 方案和 Pull Request。

1. Fork 本仓库并创建功能分支。
2. 保持修改范围清晰，避免把真实密钥、个人照片或生产数据提交到仓库。
3. 提交前运行：

   ```bash
   npx tsc --noEmit
   npm run generate
   git diff --check
   ```

4. 在 Pull Request 中说明：修改背景、实现方式、测试结果以及是否涉及数据库迁移。

## 常见问题

### 为什么登录后页面还是演示模式？

检查 `.env` 中的 Supabase URL 和 anon key，确认当前部署环境也配置了相同变量，并重新生成或重新部署静态文件。

### 为什么通话提示 Token 无效？

ZEGO 的前端 App ID 不能替代 ServerSecret。请在 Supabase Edge Function Secrets 中配置真实 `ZEGO_SERVER_SECRET`，并确认 Edge Function 返回的 App ID 与前端一致。

### 为什么照片加载失败或很慢？

确认 Storage bucket、RLS、签名地址和部署域名配置正确。项目会使用签名地址、图片变换、浏览器 Cache Storage 和分批加载，但首次访问大视频仍然受网络和文件大小影响。

### 能不能只使用网页，不构建 APK？

可以。运行 `npm run generate` 后，把 `.output/public/` 部署到静态托管即可。Android 和 Windows 是额外的发布形态，不是 Web 使用的前置条件。

## 开源协议

本项目使用 [MIT License](LICENSE)。欢迎学习、修改和提交改进，也请在使用第三方服务时遵守对应服务条款和许可证。

## 支持项目

如果 Love小家对你有帮助，欢迎：

- 点一个 Star，让更多人看到这个项目。
- Fork 后做出你们自己的情侣空间主题。
- 提交一个 Issue，告诉我你最想要的功能。
- 分享给正在寻找私密共同空间的情侣或开发者。

<p align="center">
  <strong>愿每一段认真相爱的日常，都有一个值得回来的地方。</strong><br>
  <a href="https://github.com/XTH-LOVE/Love-">访问 GitHub 项目</a> ·
  <a href="https://love-home.pages.dev/">打开在线体验</a>
</p>
