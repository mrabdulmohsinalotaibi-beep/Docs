package app.athat.docs;

import android.app.Activity;
import android.content.pm.PackageManager;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.MimeTypeMap;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.Toast;
import android.view.View;
import android.view.WindowManager;
import android.webkit.URLUtil;
import android.webkit.WebStorage;
import android.webkit.WebResourceError;
import android.webkit.WebResourceResponse;
import android.graphics.Bitmap;
import android.os.Build;

public class MainActivity extends Activity {
    private static final String START_URL = "https://docs.athat.app/";
    private static final int FILE_REQUEST = 2147;
    private static final int PLAY_UPDATE_REQUEST = 2148;
    private static final long UPDATE_CHECK_INTERVAL_MS = 6L * 60L * 60L * 1000L;
    private AppUpdateManager playUpdateManager;
    private long lastUpdateCheckAt = 0L;
    private WebView web;
    private ValueCallback<Uri[]> pendingFiles;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        web = new WebView(this);
        web.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        setContentView(web);
        WebSettings cfg = web.getSettings();
        cfg.setJavaScriptEnabled(true);
        cfg.setDomStorageEnabled(true);
        cfg.setDatabaseEnabled(true);
        cfg.setAllowFileAccess(false);
        cfg.setAllowContentAccess(true);
        cfg.setAllowFileAccessFromFileURLs(false);
        cfg.setAllowUniversalAccessFromFileURLs(false);
        cfg.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        cfg.setJavaScriptCanOpenWindowsAutomatically(false);
        cfg.setSupportMultipleWindows(false);
        cfg.setMediaPlaybackRequiresUserGesture(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        WebView.setWebContentsDebuggingEnabled(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri u = request.getUrl();
                if ("https".equals(u.getScheme()) && "docs.athat.app".equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); }
                catch (Exception e) { Toast.makeText(MainActivity.this, "تعذر فتح الرابط", Toast.LENGTH_SHORT).show(); }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFiles != null) pendingFiles.onReceiveValue(null);
                pendingFiles = callback;
                try {
                    Intent i = params.createIntent();
                    startActivityForResult(i, FILE_REQUEST);
                    return true;
                } catch (Exception e) {
                    pendingFiles = null;
                    Toast.makeText(MainActivity.this, "تعذر اختيار الملف", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });
        web.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                Uri uri = Uri.parse(url);
                if (!"https".equals(uri.getScheme())) throw new IllegalArgumentException("Only HTTPS downloads");
                DownloadManager.Request req = new DownloadManager.Request(uri);
                req.setMimeType(mimeType);
                req.addRequestHeader("User-Agent", userAgent);
                if ("docs.athat.app".equals(uri.getHost())) {
                    String cookies = CookieManager.getInstance().getCookie(url);
                    if (cookies != null) req.addRequestHeader("Cookie", cookies);
                }
                String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
                req.setTitle(name);
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalFilesDir(MainActivity.this, Environment.DIRECTORY_DOWNLOADS, name);
                ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(req);
                Toast.makeText(MainActivity.this, "بدأ تنزيل الملف", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
                catch (Exception ignored) { Toast.makeText(MainActivity.this, "تعذر تنزيل الملف", Toast.LENGTH_SHORT).show(); }
            }
        });
        if (state != null) web.restoreState(state);
        else web.loadUrl(START_URL);
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PLAY_UPDATE_REQUEST) {
            // A canceled update leaves the current installation and its local data intact.
            return;
        }
        if (requestCode == FILE_REQUEST && pendingFiles != null) {
            pendingFiles.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            pendingFiles = null;
        }
    }
    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        if (web != null) web.saveState(state);
        super.onSaveInstanceState(state);
    }
    @Override protected void onPause() {
        if (web != null) web.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }
    /**
     * Only Google Play installations are eligible for Play Core in-app updates.
     * Sideloaded debug APKs must never pretend to have automatic native updates.
     * No local WebView/IndexedDB data is cleared during an app update.
     */
    private boolean installedFromGooglePlay() {
        try {
            if (Build.VERSION.SDK_INT >= 30) {
                String installer = getPackageManager().getInstallSourceInfo(getPackageName()).getInstallingPackageName();
                return "com.android.vending".equals(installer);
            }
            return "com.android.vending".equals(getPackageManager().getInstallerPackageName(getPackageName()));
        } catch (Exception ignored) {
            return false;
        }
    }

    private void checkForPlayUpdate() {
        if (!installedFromGooglePlay()) return;
        long now = android.os.SystemClock.elapsedRealtime();
        if (lastUpdateCheckAt != 0 && now - lastUpdateCheckAt < UPDATE_CHECK_INTERVAL_MS) return;
        lastUpdateCheckAt = now;
        if (playUpdateManager == null) playUpdateManager = AppUpdateManagerFactory.create(this);
        playUpdateManager.getAppUpdateInfo().addOnSuccessListener(info -> {
            if (isFinishing() || isDestroyed()) return;
            int availability = info.updateAvailability();
            if ((availability == UpdateAvailability.UPDATE_AVAILABLE
                    || availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS)
                    && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                try {
                    playUpdateManager.startUpdateFlowForResult(
                        info, this, AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build(),
                        PLAY_UPDATE_REQUEST);
                } catch (Exception ignored) {
                    // The user can continue working offline; updates are retried at a later launch.
                }
            }
        });
    }

    @Override protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        checkForPlayUpdate();
    }
    @Override protected void onDestroy() {
        CookieManager.getInstance().flush();
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
