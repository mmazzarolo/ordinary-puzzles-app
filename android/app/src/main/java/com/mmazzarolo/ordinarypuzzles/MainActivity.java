package com.mmazzarolo.ordinarypuzzles;

import android.os.Bundle;

import com.facebook.react.ReactActivity;
import com.zoontek.rnbootsplash.RNBootSplash;
import com.rnimmersive.RNImmersiveModule;

public class MainActivity extends ReactActivity {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  @Override
  protected String getMainComponentName() {
    return "OrdinaryPuzzles";
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    RNBootSplash.show(R.drawable.bootsplash, MainActivity.this);
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus && RNImmersiveModule.getInstance() != null) {
      RNImmersiveModule.getInstance().emitImmersiveStateChangeEvent();
    }
 }
}
