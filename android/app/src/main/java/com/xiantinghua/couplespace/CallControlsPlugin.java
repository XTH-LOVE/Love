package com.xiantinghua.couplespace;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CallControls")
public class CallControlsPlugin extends Plugin {
    private static final int OVERLAY_TEXT_SIZE = 13;
    private static final String INCOMING_CHANNEL_ID = "love-home-incoming-call";
    private static final int INCOMING_NOTIFICATION_ID = 2404;
    private Ringtone ringtone;
    private Vibrator vibrator;
    private WindowManager windowManager;
    private View overlayView;

    @PluginMethod
    public void startCallService(PluginCall call) {
        String mode = "video".equals(call.getString("mode")) ? "video" : "audio";
        try {
            Intent intent = new Intent(getContext(), CallForegroundService.class)
                    .setAction(CallForegroundService.ACTION_START)
                    .putExtra(CallForegroundService.EXTRA_MODE, mode);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(getContext(), intent);
            } else {
                getContext().startService(intent);
            }
            call.resolve();
        } catch (SecurityException error) {
            call.reject("通话前台服务需要麦克风" + ("video".equals(mode) ? "和摄像头" : "") + "权限，请在系统设置中允许后重试", error);
        } catch (Exception error) {
            call.reject("无法启动通话后台服务，请重新打开应用后重试", error);
        }
    }

    @PluginMethod
    public void stopCallService(PluginCall call) {
        stopIncomingAlertInternal();
        hideOverlayInternal();
        getContext().stopService(new Intent(getContext(), CallForegroundService.class));
        call.resolve();
    }

    @PluginMethod
    public void startIncomingAlert(PluginCall call) {
        stopIncomingAlertInternal();
        showIncomingNotification();
        Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        ringtone = RingtoneManager.getRingtone(getContext(), uri);
        if (ringtone != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) ringtone.setLooping(true);
            ringtone.play();
        }
        vibrator = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator != null && vibrator.hasVibrator()) {
            long[] pattern = new long[] { 0, 450, 220, 450, 900 };
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
            } else {
                vibrator.vibrate(pattern, 0);
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void stopIncomingAlert(PluginCall call) {
        stopIncomingAlertInternal();
        call.resolve();
    }

    @PluginMethod
    public void getOverlayPermission(PluginCall call) {
        boolean granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(getContext());
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void showCallOverlay(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
            call.reject("请先允许 Love小家 显示在其他应用上层");
            return;
        }
        String text = call.getString("text", "Love小家通话中");
        getActivity().runOnUiThread(() -> showOverlayInternal(text));
        call.resolve();
    }

    @PluginMethod
    public void hideCallOverlay(PluginCall call) {
        getActivity().runOnUiThread(this::hideOverlayInternal);
        call.resolve();
    }

    private void stopIncomingAlertInternal() {
        if (ringtone != null) {
            ringtone.stop();
            ringtone = null;
        }
        if (vibrator != null) {
            vibrator.cancel();
            vibrator = null;
        }
        NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(INCOMING_NOTIFICATION_ID);
    }

    private void showIncomingNotification() {
        NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    INCOMING_CHANNEL_ID,
                    "Love小家来电",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("情侣通话来电提醒");
            // The plugin plays the device ringtone directly so the notification does not double-ring.
            channel.setSound(null, null);
            channel.enableVibration(false);
            manager.createNotificationChannel(channel);
        }
        Intent launch = getContext().getPackageManager().getLaunchIntentForPackage(getContext().getPackageName());
        if (launch == null) return;
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
                getContext(), 2405, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification notification = new NotificationCompat.Builder(getContext(), INCOMING_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_couplespace_foreground)
                .setContentTitle("Love小家来电")
                .setContentText("TA 正在呼叫你，点击返回接听")
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(false)
                .setOngoing(true)
                .setFullScreenIntent(pending, true)
                .setContentIntent(pending)
                .addAction(android.R.drawable.ic_menu_call, "打开接听", pending)
                .setTimeoutAfter(60_000)
                .build();
        manager.notify(INCOMING_NOTIFICATION_ID, notification);
    }

    private void showOverlayInternal(String text) {
        if (overlayView != null) {
            ((TextView) overlayView).setText(text);
            return;
        }
        windowManager = (WindowManager) getContext().getSystemService(Context.WINDOW_SERVICE);
        TextView bubble = new TextView(getContext());
        bubble.setText(text);
        bubble.setTextColor(Color.WHITE);
        bubble.setTextSize(OVERLAY_TEXT_SIZE);
        bubble.setGravity(Gravity.CENTER);
        bubble.setPadding(28, 17, 28, 17);
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.argb(235, 83, 48, 99));
        background.setCornerRadius(80);
        bubble.setBackground(background);
        bubble.setElevation(12);
        bubble.setOnClickListener(view -> {
            Intent launch = getContext().getPackageManager().getLaunchIntentForPackage(getContext().getPackageName());
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                getContext().startActivity(launch);
            }
        });
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.END;
        params.x = 18;
        params.y = 120;
        try {
            windowManager.addView(bubble, params);
            overlayView = bubble;
        } catch (Exception ignored) {
            overlayView = null;
        }
    }

    private void hideOverlayInternal() {
        if (windowManager != null && overlayView != null) {
            try { windowManager.removeView(overlayView); } catch (Exception ignored) { }
        }
        overlayView = null;
    }
}
