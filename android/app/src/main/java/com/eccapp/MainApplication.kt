package com.eccapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

// 🖥️ SCREEN SHARE FIX — Ye imports missing the
import com.livekit.reactnative.LiveKitReactNative
import com.livekit.reactnative.audio.AudioType

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()

    // 🖥️ SCREEN SHARE FIX
    // LiveKit React Native SDK ko is call se native side (audio session,
    // foreground service ke liye mediaProjection handling, WebRTC setup)
    // initialize karna hota hai. Isके bina camera/mic to kaam kar sakte
    // hain kyunki wo standard permissions se chal jaate hain, lekin
    // screen share ka mediaProjection foreground service properly wire
    // hi nahi hota — isliye track capture to hota hai (local UI update ho
    // jaata hai) lekin publish/encode pipeline bhroken rehta hai aur
    // remote participants ko kabhi kuch nahi milta.
    //
    // IMPORTANT: Ye call loadReactNative(this) se PEHLE hona zaroori hai.
    LiveKitReactNative.setup(this, AudioType.CommunicationAudioType())

    loadReactNative(this)
  }
}