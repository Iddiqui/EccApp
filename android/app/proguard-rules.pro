# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ----------------------------------------------------
# LiveKit & WebRTC Keep Rules
# ----------------------------------------------------
-keep class livekit.** { *; }
-keep interface livekit.** { *; }
-keep class org.webrtc.** { *; }
-keep interface org.webrtc.** { *; }

# ----------------------------------------------------
# React Native & Native Bridge Rules
# ----------------------------------------------------
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.eclipsesource.v8.** { *; }

# Audio & Media Native Modules
-keep class com.dooboolab.audiopolicy.** { *; }
-keep class com.rnim.rn.audio.** { *; }

# Don't warn for missing references in 3rd party libs
-dontwarn livekit.**
-dontwarn org.webrtc.**
-dontwarn com.facebook.react.**