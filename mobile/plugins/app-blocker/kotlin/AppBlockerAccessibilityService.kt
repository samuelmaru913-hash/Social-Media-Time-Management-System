package com.dikiaa.mobile.blocker

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Watches which app is in the foreground and enforces the rules synced from the
 * React Native side:
 *
 *  - blocked app              -> immediately covered by a full-screen overlay
 *  - app with a daily limit   -> foreground time is counted; when the limit is
 *                                reached an overlay is shown and cannot be dismissed
 *                                without leaving the app
 *
 * The overlay uses TYPE_ACCESSIBILITY_OVERLAY, so no extra "draw over other
 * apps" permission is required. The user only has to enable this accessibility
 * service once.
 */
class AppBlockerAccessibilityService : AccessibilityService() {

    private lateinit var windowManager: WindowManager
    private var overlayView: View? = null
    private var overlayPackage: String? = null

    private var currentPackage: String? = null
    private val pendingUsage = HashMap<String, Long>()
    private var lastFlush = 0L
    private var screenReceiverRegistered = false

    private val handler = Handler(Looper.getMainLooper())
    private val ticker = object : Runnable {
        override fun run() {
            onTick()
            handler.postDelayed(this, 1000L)
        }
    }

    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == Intent.ACTION_SCREEN_OFF) {
                switchForeground(null)
                removeOverlay()
                flushPending()
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        BlockerConfig.ensureToday(this)
        registerScreenReceiver()
        handler.post(ticker)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null || event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return

        if (pkg == packageName || pkg == "com.android.systemui") {
            switchForeground(null)
            removeOverlay()
            return
        }

        switchForeground(pkg)
        evaluate(pkg)
    }

    override fun onInterrupt() {
        // Nothing to interrupt - the service is always passive.
    }

    override fun onDestroy() {
        handler.removeCallbacks(ticker)
        unregisterScreenReceiver()
        flushPending()
        removeOverlay()
        super.onDestroy()
    }

    // ── Foreground tracking ───────────────────────────────────────────────────

    private fun switchForeground(next: String?) {
        if (next == currentPackage) return
        flushPending()
        currentPackage = next
    }

    private fun onTick() {
        val pkg = currentPackage
        if (pkg != null && BlockerConfig.isTracked(this, pkg)) {
            pendingUsage[pkg] = (pendingUsage[pkg] ?: 0L) + 1L
        }
        if (pkg != null) evaluate(pkg)

        val now = System.currentTimeMillis()
        if (now - lastFlush >= 5_000L) {
            flushPending()
            lastFlush = now
        }
    }

    private fun flushPending() {
        if (pendingUsage.isEmpty()) return
        val snapshot = HashMap(pendingUsage)
        pendingUsage.clear()
        for ((pkg, seconds) in snapshot) {
            BlockerConfig.addUsageSeconds(this, pkg, seconds)
        }
    }

    // ── Rule evaluation ───────────────────────────────────────────────────────

    private fun evaluate(pkg: String) {
        val (restricted, reason) = checkRestriction(pkg)
        if (restricted) {
            if (overlayPackage != pkg || overlayView == null) {
                showOverlay(pkg, reason)
            }
        } else if (overlayPackage == pkg) {
            removeOverlay()
        }
    }

    private fun checkRestriction(pkg: String): Pair<Boolean, String> {
        if (pkg == packageName) return false to ""

        if (BlockerConfig.blockedPackages(this).contains(pkg)) {
            return true to REASON_BLOCKED
        }

        val limitMinutes = BlockerConfig.limitMinutes(this, pkg)
        if (limitMinutes <= 0) return false to ""

        val usedSeconds = BlockerConfig.usageSeconds(this, pkg) + (pendingUsage[pkg] ?: 0L)
        return if (usedSeconds >= limitMinutes * 60L) {
            true to REASON_LIMIT
        } else {
            false to ""
        }
    }

    // ── Blocking overlay ──────────────────────────────────────────────────────

    private fun showOverlay(pkg: String, reason: String) {
        removeOverlay()

        val appLabel = appLabel(pkg)
        val isBlocked = reason == REASON_BLOCKED

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0D1B3E"))
            setPadding(dp(28), dp(40), dp(28), dp(40))
            isClickable = true
        }

        root.addView(TextView(this).apply {
            text = if (isBlocked) "\uD83D\uDEAB" else "\u23F0"
            textSize = 56f
            gravity = Gravity.CENTER
        })

        root.addView(TextView(this).apply {
            text = if (isBlocked) "App Blocked" else "Time's Up"
            textSize = 28f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, dp(16), 0, dp(8))
        })

        root.addView(TextView(this).apply {
            text = if (isBlocked) {
                "$appLabel is blocked by your FocusNo rules."
            } else {
                "You've reached your daily limit for $appLabel."
            }
            textSize = 15f
            setTextColor(Color.parseColor("#B8C4E0"))
            gravity = Gravity.CENTER
            setPadding(dp(12), 0, dp(12), dp(8))
        })

        if (!isBlocked) {
            val limit = BlockerConfig.limitMinutes(this, pkg)
            val used = (BlockerConfig.usageSeconds(this, pkg) + (pendingUsage[pkg] ?: 0L)) / 60
            root.addView(TextView(this).apply {
                text = "Used ${used}m of ${limit}m today"
                textSize = 13f
                setTextColor(Color.parseColor("#8FA3C8"))
                gravity = Gravity.CENTER
                setPadding(0, 0, 0, dp(8))
            })
        }

        root.addView(Button(this).apply {
            text = "Go to Home"
            textSize = 16f
            setAllCaps(false)
            setTextColor(Color.WHITE)
            background = roundedBackground("#208AEF")
            setOnClickListener {
                performGlobalAction(GLOBAL_ACTION_HOME)
                removeOverlay()
            }
        }, buttonParams(topMargin = dp(28)))

        root.addView(Button(this).apply {
            text = "Open FocusNo"
            textSize = 16f
            setAllCaps(false)
            setTextColor(Color.parseColor("#208AEF"))
            background = roundedBackground("#162955")
            setOnClickListener {
                openFocusNo()
                removeOverlay()
            }
        }, buttonParams(topMargin = dp(12)))

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
        }

        try {
            windowManager.addView(root, params)
            overlayView = root
            overlayPackage = pkg
        } catch (_: Exception) {
            overlayView = null
            overlayPackage = null
        }
    }

    private fun removeOverlay() {
        val view = overlayView ?: return
        try {
            windowManager.removeView(view)
        } catch (_: Exception) {
            // Already detached.
        }
        overlayView = null
        overlayPackage = null
    }

    private fun openFocusNo() {
        try {
            val intent = packageManager.getLaunchIntentForPackage(packageName)
            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                startActivity(intent)
            }
        } catch (_: Exception) {
            // Ignore - the home button is still available.
        }
    }

    private fun appLabel(pkg: String): String = try {
        val info = packageManager.getApplicationInfo(pkg, 0)
        packageManager.getApplicationLabel(info).toString()
    } catch (_: Exception) {
        pkg
    }

    private fun roundedBackground(color: String): GradientDrawable =
        GradientDrawable().apply {
            setColor(Color.parseColor(color))
            cornerRadius = dp(14).toFloat()
        }

    private fun buttonParams(topMargin: Int): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(52)
        ).apply {
            this.topMargin = topMargin
        }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    // ── Screen on/off ─────────────────────────────────────────────────────────

    private fun registerScreenReceiver() {
        if (screenReceiverRegistered) return
        try {
            val filter = IntentFilter(Intent.ACTION_SCREEN_OFF)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(screenReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                registerReceiver(screenReceiver, filter)
            }
            screenReceiverRegistered = true
        } catch (_: Exception) {
            // Ignore - tracking still works while the screen is on.
        }
    }

    private fun unregisterScreenReceiver() {
        if (!screenReceiverRegistered) return
        try {
            unregisterReceiver(screenReceiver)
        } catch (_: Exception) {
            // Already unregistered.
        }
        screenReceiverRegistered = false
    }

    companion object {
        private const val REASON_BLOCKED = "blocked"
        private const val REASON_LIMIT = "limit"
    }
}
