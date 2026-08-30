import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native iOS / Android shell.
 *
 * Run locally after exporting the repo:
 *   bun add -d @capacitor/cli && bun add @capacitor/core @capacitor/haptics @capacitor/camera @capacitor/share
 *   bun run build
 *   bunx cap add ios && bunx cap add android
 *   bunx cap sync && bunx cap open ios
 *
 * The app requests camera access through the system WebView, so add these to the
 * native projects:
 *   iOS   Info.plist -> NSCameraUsageDescription, NSPhotoLibraryAddUsageDescription
 *   Android AndroidManifest.xml -> android.permission.CAMERA
 */
const config: CapacitorConfig = {
  appId: "app.lovable.vintagecamera",
  appName: "Vintage Camera",
  webDir: ".output/public",
  ios: {
    contentInset: "always",
    backgroundColor: "#1b1917",
  },
  android: {
    backgroundColor: "#1b1917",
  },
  plugins: {
    Haptics: {},
  },
};

export default config;
