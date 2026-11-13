# What R8 must leave as it is when it makes the release APK smaller.
#
# The app's own classes are kept whole, names and all. The WebView's bridge
# methods are found by name from the page, the hotspot helper is started
# by its class name through app_process as Android's shell, the manifest
# names the activity, the services, the receivers and the provider, and
# the helper's Binder codes must match on both sides.
-keep class dev.evthefuture.murekaplayer.** { *; }

# The adb library pairs with wireless debugging and starts the helper. It
# is kept whole, as what it finds by reflection is not known here.
-keep class io.github.muntashirakon.adb.** { *; }

# Bouncy Castle makes the adb key's certificate. Its classes keep their
# names, so anything it looks up by name is still found, and R8 may leave
# out the many it never reaches, which is where the size goes.
-keepnames class org.bouncycastle.** { *; }

# Classes Bouncy Castle and the adb library refer to on paths the app never
# takes, which Android does not have.
-dontwarn javax.naming.**
-dontwarn java.awt.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn sun.security.**
-dontwarn org.bouncycastle.**

# The stack traces in the debug log keep their line numbers.
-keepattributes SourceFile,LineNumberTable
