# FCM 后台来电配置

当前代码已经接入设备 Token 注册和 `send-call-push` Edge Function。完成下面的外部配置后，应用被系统杀死时才能收到真正的后台来电通知。

1. 在 Firebase 项目中添加 Android 应用，包名必须是 `com.xiantinghua.couplespace`。
2. 下载 `google-services.json`，放到 `D:\dev\CoupleSpace\android\app\google-services.json`。该文件已加入 `.gitignore`，不要提交到 GitHub。
3. 在 Supabase SQL Editor 执行 `supabase/migrations/015_push_tokens.sql`。
4. 在 Firebase Service accounts 中生成私钥文件，临时放在项目外，然后设置 Edge Function Secret：

```powershell
npx supabase secrets set --project-ref soketalclkibyilenvzv FIREBASE_SERVICE_ACCOUNT_JSON="$(Get-Content C:\path\firebase-service-account.json -Raw)"
```

5. 重新同步和构建 Android：

```powershell
npx cap sync android
$env:JAVA_HOME='C:\Program Files\Java\jdk-21.0.11'
cd android
.\gradlew.bat assembleDebug
```

未配置 `google-services.json` 或 `FIREBASE_SERVICE_ACCOUNT_JSON` 时，应用仍可使用前台通话和本地来电通知，但不会发送后台 FCM 来电。
