package com.transportsligneo.driver;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.BridgeActivity;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {
  private static final String CHANNEL_ID = "ligneo_downloads";

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    try {
      // Permet au site d'enregistrer un PDF dans « Téléchargements » comme un vrai téléchargement.
      getBridge().getWebView().addJavascriptInterface(new LigneoNative(), "LigneoNative");
    } catch (Exception ignored) {
      // Sans ce pont, le site retombe sur la fenêtre de partage.
    }
  }

  /** Pont utilisé par le site (window.LigneoNative). */
  public class LigneoNative {
    @JavascriptInterface
    public boolean hasDownloads() {
      return true;
    }

    @JavascriptInterface
    public boolean saveFile(String base64, String filename, String mime) {
      try {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false;
        byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
        String safeName = filename.replaceAll("[^A-Za-z0-9._-]", "_");
        String type = (mime == null || mime.isEmpty()) ? "application/pdf" : mime;

        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
        values.put(MediaStore.Downloads.MIME_TYPE, type);
        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        ContentResolver resolver = getContentResolver();
        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) return false;
        OutputStream out = resolver.openOutputStream(uri);
        if (out == null) return false;
        try {
          out.write(bytes);
        } finally {
          out.close();
        }
        values.clear();
        values.put(MediaStore.Downloads.IS_PENDING, 0);
        resolver.update(uri, values, null, null);

        notifyDownloaded(uri, safeName, type);
        return true;
      } catch (Exception e) {
        return false;
      }
    }
  }

  private void notifyDownloaded(final Uri uri, final String name, String type) {
    runOnUiThread(
        new Runnable() {
          @Override
          public void run() {
            Toast.makeText(MainActivity.this, "Téléchargé dans Téléchargements : " + name, Toast.LENGTH_LONG).show();
          }
        });
    try {
      NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        nm.createNotificationChannel(
            new NotificationChannel(CHANNEL_ID, "Téléchargements", NotificationManager.IMPORTANCE_DEFAULT));
      }
      Intent open = new Intent(Intent.ACTION_VIEW);
      open.setDataAndType(uri, type);
      open.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
      PendingIntent pending =
          PendingIntent.getActivity(
              this, (int) (System.currentTimeMillis() % 100000), open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
      NotificationCompat.Builder builder =
          new NotificationCompat.Builder(this, CHANNEL_ID)
              .setSmallIcon(android.R.drawable.stat_sys_download_done)
              .setContentTitle("Téléchargement terminé")
              .setContentText(name)
              .setContentIntent(pending)
              .setAutoCancel(true);
      nm.notify((int) (System.currentTimeMillis() % 1000000), builder.build());
    } catch (Exception ignored) {
      // La notification est un confort : le fichier est déjà enregistré.
    }
  }
}
