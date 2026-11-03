package com.dikiaa.mobile.blocker

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Shared storage used by both the JavaScript bridge (BlockerModule) and the
 * background AccessibilityService. Everything is kept in one SharedPreferences
 * file so the foreground app can change rules and the service picks them up
 * immediately.
 */
object BlockerConfig {
    private const val PREFS = "focuson_blocker"
    private const val KEY_BLOCKED = "blocked"
    private const val KEY_LIMITS = "limits"
    private const val KEY_USAGE = "usage"
    private const val KEY_USAGE_DATE = "usage_date"
    private const val KEY_SEEDED_DATE = "seeded_date"

    fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    @Synchronized
    fun ensureToday(context: Context) {
        val p = prefs(context)
        val today = today()
        if (p.getString(KEY_USAGE_DATE, null) != today) {
            p.edit()
                .putString(KEY_USAGE_DATE, today)
                .putString(KEY_USAGE, "{}")
                .putString(KEY_SEEDED_DATE, "")
                .apply()
        }
    }

    /**
     * config JSON shape:
     * {
     *   "blocked": ["com.instagram.android"],
     *   "limits":  { "com.instagram.android": 30 },
     *   "usage":   { "com.instagram.android": 600 }
     * }
     */
    @Synchronized
    fun applyConfig(context: Context, configJson: String) {
        ensureToday(context)
        val p = prefs(context)
        val obj = try {
            JSONObject(configJson)
        } catch (_: Exception) {
            return
        }

        val today = today()
        val editor = p.edit()
        editor.putString(KEY_BLOCKED, obj.optJSONArray("blocked")?.toString() ?: "[]")
        editor.putString(KEY_LIMITS, obj.optJSONObject("limits")?.toString() ?: "{}")

        // Seed local usage from the server only once per day, keeping whichever
        // counter is higher so time already tracked on-device is never lost.
        val seeded = p.getString(KEY_SEEDED_DATE, "") == today
        if (!seeded) {
            val backend = obj.optJSONObject("usage") ?: JSONObject()
            val merged = usage(context)
            val keys = backend.keys()
            while (keys.hasNext()) {
                val pkg = keys.next()
                merged[pkg] = maxOf(backend.optLong(pkg, 0L), merged[pkg] ?: 0L)
            }
            editor.putString(KEY_USAGE, toJson(merged))
            editor.putString(KEY_SEEDED_DATE, today)
        }

        editor.apply()
    }

    @Synchronized
    fun blockedPackages(context: Context): Set<String> {
        ensureToday(context)
        val raw = prefs(context).getString(KEY_BLOCKED, "[]") ?: "[]"
        return try {
            val arr = JSONArray(raw)
            val out = HashSet<String>(arr.length())
            for (i in 0 until arr.length()) {
                val pkg = arr.optString(i)
                if (pkg.isNotEmpty()) out.add(pkg)
            }
            out
        } catch (_: Exception) {
            emptySet()
        }
    }

    @Synchronized
    fun limits(context: Context): Map<String, Int> {
        ensureToday(context)
        val raw = prefs(context).getString(KEY_LIMITS, "{}") ?: "{}"
        return try {
            val obj = JSONObject(raw)
            val out = HashMap<String, Int>()
            val keys = obj.keys()
            while (keys.hasNext()) {
                val pkg = keys.next()
                out[pkg] = obj.optInt(pkg, 0)
            }
            out
        } catch (_: Exception) {
            emptyMap()
        }
    }

    @Synchronized
    fun usage(context: Context): MutableMap<String, Long> {
        ensureToday(context)
        val raw = prefs(context).getString(KEY_USAGE, "{}") ?: "{}"
        val out = HashMap<String, Long>()
        try {
            val obj = JSONObject(raw)
            val keys = obj.keys()
            while (keys.hasNext()) {
                val pkg = keys.next()
                out[pkg] = obj.optLong(pkg, 0L)
            }
        } catch (_: Exception) {
            // corrupt storage - start fresh
        }
        return out
    }

    @Synchronized
    fun addUsageSeconds(context: Context, packageName: String, seconds: Long) {
        if (seconds <= 0) return
        val current = usage(context)
        current[packageName] = (current[packageName] ?: 0L) + seconds
        prefs(context).edit().putString(KEY_USAGE, toJson(current)).apply()
    }

    @Synchronized
    fun usageSeconds(context: Context, packageName: String): Long = usage(context)[packageName] ?: 0L

    @Synchronized
    fun limitMinutes(context: Context, packageName: String): Int = limits(context)[packageName] ?: 0

    @Synchronized
    fun isTracked(context: Context, packageName: String): Boolean {
        if (blockedPackages(context).contains(packageName)) return true
        return (limits(context)[packageName] ?: 0) > 0
    }

    private fun toJson(map: Map<String, Long>): String {
        val obj = JSONObject()
        for ((key, value) in map) obj.put(key, value)
        return obj.toString()
    }
}
