# Love小家更新方式

## 网页和电脑软件

网页部署到 `https://love-home.pages.dev/` 后，部署工作流会根据 `package.json` 版本和 GitHub 提交 SHA 自动生成 `public/app-update.json`。已打开的网页会在启动、切回前台、获得焦点以及定时检查时发现新构建，并提示刷新到最新版；电脑端下次打开也会直接加载最新网页。网页界面和业务逻辑更新不需要重新制作 EXE。

## Android APK

1. 修改 `package.json` 和 `nuxt.config.ts` 中的版本号，例如 `1.0.0` -> `1.0.1`。
2. 构建最新版 APK：`npm run android:apk`。
3. 将 APK 上传到 `https://love-home.pages.dev/downloads/Love小家-latest.apk`。
4. 推送到 `main`，Cloudflare 工作流会自动更新 `app-update.json`。如需自定义提示文案，可在 GitHub Actions Variables 中设置 `APP_UPDATE_NOTES`，多条说明用 `||` 分隔。
5. 用户打开 App 或回到前台后会看到更新提示，点击后下载最新版 APK 并由 Android 完成安装确认。

Android 出于系统安全限制，首次安装未知来源应用时，用户仍需要允许浏览器或文件管理器安装应用；应用不能在后台静默替换自身。
