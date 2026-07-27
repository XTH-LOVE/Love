package com.xiantinghua.couplespace;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class CallForegroundService extends Service {
    public static final String ACTION_START = "com.xiantinghua.couplespace.CALL_START";
    public static final String ACTION_STOP = "com.xiantinghua.couplespace.CALL_STOP";
    public static final String EXTRA_MODE = "mode";
    private static final String CHANNEL_ID = "love-home-call-service";
    private static final int NOTIFICATION_ID = 2401;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        String mode = intent == null ? "audio" : intent.getStringExtra(EXTRA_MODE);
        promote(mode);
        return START_NOT_STICKY;
    }

    private void promote(String mode) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Love小家通话",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("通话进行中时保持音频连接");
            channel.setSound(null, null);
            channel.enableVibration(false);
            manager.createNotificationChannel(channel);
        }
        Intent openIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent openPending = openIntent == null ? null : PendingIntent.getActivity(
                this, 2402, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Intent stopIntent = new Intent(this, CallForegroundService.class).setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(
                this, 2403, stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        String label = "video".equals(mode) ? "视频通话进行中" : "语音通话进行中";
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_couplespace_foreground)
                .setContentTitle("Love小家")
                .setContentText(label + "，点击返回通话")
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(openPending)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "结束通话", stopPending)
                .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            int serviceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
            if ("video".equals(mode)) serviceType |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
            startForeground(NOTIFICATION_ID, notification, serviceType);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    @Override
    public void onDestroy() {
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
