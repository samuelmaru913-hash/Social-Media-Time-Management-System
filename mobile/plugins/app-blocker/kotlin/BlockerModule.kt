package com.dikiaa.mobile.blocker

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Base64
import android.util.LruCache
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors

/**
 * JS <-> native bridge for the app blocker.
 *
 * The JavaScript side calls [syncConfig] whenever blocked apps / limits change.
 * The accessibility service reads the same SharedPreferences file and enforces
 * the rules even while the React Native app is not running.
 */
class BlockerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    /** data-URI launcher icons, kept so re-opening the app picker is instant. */
    private val iconCache = LruCache<String, String>(MAX_CACHED_ICONS)

    /** Icons are rendered off the JS/native bridge thread so the UI never blocks. */
    private val iconExecutor = Executors.newFixedThreadPool(ICON_THREADS)

    @ReactMethod
    fun syncConfig(configJson: String) {
        BlockerConfig.applyConfig(reactContext, configJson)
    }

    /**
     * Returns every launchable app installed on the device as a JSON array of
     * { packageName, appName }. System services and this app itself are skipped.
     */
    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            val resolveInfos = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(0L))
            } else {
                @Suppress("DEPRECATION")
                pm.queryIntentActivities(intent, 0)
            }

            val result = JSONArray()
            val seen = HashSet<String>()
            for (info in resolveInfos) {
                val pkg = info.activityInfo?.packageName ?: continue
                if (pkg == reactContext.packageName) continue
                if (!seen.add(pkg)) continue
                val label = try {
                    info.loadLabel(pm).toString()
                } catch (_: Exception) {
                    pkg
                }
                val obj = JSONObject()
                obj.put("packageName", pkg)
                obj.put("appName", label)
                result.put(obj)
            }
            promise.resolve(result.toString())
        } catch (error: Exception) {
            promise.reject("ERR_BLOCKER_APPS", error)
        }
    }

    @ReactMethod
    fun openApkInstaller(apkUri: String, promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                !reactContext.packageManager.canRequestPackageInstalls()
            ) {
                val settingsIntent = Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:${reactContext.packageName}")
                )
                currentActivity?.startActivity(settingsIntent)
                    ?: reactContext.startActivity(settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                promise.resolve("permission_required")
                return
            }

            val uri = Uri.parse(apkUri)
            require(uri.scheme == "content") { "Select an APK from the Android file picker." }

            val installIntent = Intent(Intent.ACTION_INSTALL_PACKAGE).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            currentActivity?.startActivity(installIntent)
                ?: reactContext.startActivity(installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            promise.resolve("opened")
        } catch (error: Exception) {
            promise.reject("ERR_APK_INSTALLER", error)
        }
    }

    /**
     * Returns the real launcher icon for [packageName] as a base64 data URI.
     * Served from an in-memory cache when available.
     */
    @ReactMethod
    fun getAppIcon(packageName: String, promise: Promise) {
        val cached = iconCache.get(packageName)
        if (cached != null) {
            promise.resolve(cached)
            return
        }
        iconExecutor.execute {
            try {
                val icon = buildIconDataUri(packageName)
                if (icon != null) iconCache.put(packageName, icon)
                promise.resolve(icon ?: "")
            } catch (error: Exception) {
                promise.reject("ERR_APP_ICON", error)
            }
        }
    }

    /**
     * Batch version of [getAppIcon]. Accepts a JSON array of package names and
     * resolves a JSON object of packageName -> base64 data URI. This lets the
     * picker fetch every visible icon in one bridge call.
     */
    @ReactMethod
    fun getAppIcons(packageNamesJson: String, promise: Promise) {
        try {
            val names = JSONArray(packageNamesJson)
            iconExecutor.execute {
                val result = JSONObject()
                for (i in 0 until names.length()) {
                    val pkg = names.optString(i)
                    if (pkg.isEmpty()) continue
                    val cached = iconCache.get(pkg)
                    if (cached != null) {
                        result.put(pkg, cached)
                        continue
                    }
                    try {
                        val icon = buildIconDataUri(pkg)
                        if (icon != null) {
                            iconCache.put(pkg, icon)
                            result.put(pkg, icon)
                        }
                    } catch (_: Exception) {
                        // Skip unreadable icons; the JS side shows a fallback.
                    }
                }
                promise.resolve(result.toString())
            }
        } catch (error: Exception) {
            promise.reject("ERR_APP_ICONS", error)
        }
    }

    private fun buildIconDataUri(packageName: String): String? {
        val pm = reactContext.packageManager
        val drawable = pm.getApplicationIcon(packageName)
        val bitmap = when (drawable) {
            is BitmapDrawable -> drawable.bitmap
            else -> {
                val bmp = Bitmap.createBitmap(ICON_SIZE, ICON_SIZE, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(bmp)
                drawable.setBounds(0, 0, ICON_SIZE, ICON_SIZE)
                drawable.draw(canvas)
                bmp
            }
        }
        val scaled =
            if (bitmap.width == ICON_SIZE && bitmap.height == ICON_SIZE) bitmap
            else Bitmap.createScaledBitmap(bitmap, ICON_SIZE, ICON_SIZE, true)
        val out = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.PNG, 100, out)
        val base64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        return "data:image/png;base64,$base64"
    }

    @ReactMethod
    fun getUsageToday(promise: Promise) {
        try {
            val usage = BlockerConfig.usage(reactContext)
            val json = JSONObject()
            for ((pkg, seconds) in usage) json.put(pkg, seconds)
            promise.resolve(json.toString())
        } catch (error: Exception) {
            promise.reject("ERR_BLOCKER_USAGE", error)
        }
    }

    @ReactMethod
    fun isAccessibilityEnabled(promise: Promise) {
        promise.resolve(isAccessibilityServiceEnabled())
    }

    @ReactMethod
    fun openAccessibilitySettings() {
        startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
    }

    @ReactMethod
    fun isUsageAccessEnabled(promise: Promise) {
        promise.resolve(hasUsageAccess())
    }

    @ReactMethod
    fun openUsageAccessSettings() {
        startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
    }

    @ReactMethod
    fun openAppSettings() {
        val intent = Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:${reactContext.packageName}")
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            reactContext.startActivity(intent)
        } catch (_: Exception) {
            // Ignore - the caller can fall back to the general settings screen.
        }
    }

    private fun startActivity(intent: Intent) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
        } catch (_: Exception) {
            // Some OEMs hide the usage-access screen; open app settings instead.
            openAppSettings()
        }
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val expected = "${reactContext.packageName}/${AppBlockerAccessibilityService::class.java.name}"
        val shortExpected = "${reactContext.packageName}/.blocker.AppBlockerAccessibilityService"
        val enabled = Settings.Secure.getString(
            reactContext.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        return enabled.split(':').any { service ->
            service.equals(expected, ignoreCase = true) ||
                service.equals(shortExpected, ignoreCase = true)
        }
    }

    @Suppress("DEPRECATION")
    private fun hasUsageAccess(): Boolean {
        return try {
            val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                appOps.unsafeCheckOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    reactContext.packageName
                )
            } else {
                appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    reactContext.packageName
                )
            }
            mode == AppOpsManager.MODE_ALLOWED
        } catch (_: Exception) {
            false
        }
    }

    companion object {
        const val NAME = "FocusNoBlocker"
        private const val ICON_SIZE = 72
        private const val MAX_CACHED_ICONS = 200
        private const val ICON_THREADS = 4
    }
}
