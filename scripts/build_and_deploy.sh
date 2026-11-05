#!/bin/bash
# Gradle-less build, same toolchain as apps/communion-counter.
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

BUILD_TOOLS="/Users/apple/Library/Android/sdk/build-tools/35.0.0"
PLATFORM="/Users/apple/Library/Android/sdk/platforms/android-33/android.jar"
KEYSTORE="/tmp/debug.keystore"

echo "=== Building GeoSrbija APK ==="
rm -rf build && mkdir -p build/gen build/classes build/dex

if [ ! -f "$KEYSTORE" ]; then
    keytool -genkey -v -keystore "$KEYSTORE" -storepass android -alias androiddebugkey -keypass android \
        -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
fi

[ -f res/mipmap-mdpi/ic_launcher.png ] || python3 scripts/make_icon.py

"$BUILD_TOOLS/aapt2" compile --dir res -o build/compiled_res.zip
"$BUILD_TOOLS/aapt2" link -I "$PLATFORM" --manifest AndroidManifest.xml -A assets \
    -o build/base.apk --java build/gen --auto-add-overlay build/compiled_res.zip

javac --release 8 -encoding UTF-8 -cp "$PLATFORM" -d build/classes \
    build/gen/rs/geosrbija/R.java src/rs/geosrbija/MainActivity.java
"$BUILD_TOOLS/d8" --release --min-api 21 --lib "$PLATFORM" --output build/dex/ $(find build/classes -name "*.class")

(cd build/dex && zip -q -u ../base.apk classes.dex)
"$BUILD_TOOLS/zipalign" -f -p 4 build/base.apk build/aligned.apk
"$BUILD_TOOLS/apksigner" sign --ks "$KEYSTORE" --ks-pass pass:android --key-pass pass:android \
    --out build/GeoSrbija.apk build/aligned.apk

echo "=== Build Successful ==="
ls -lh build/GeoSrbija.apk

# Install on every connected device (Galaxy Note 10.1, phones...)
for dev in $(adb devices | awk 'NR>1 && $2=="device" {print $1}'); do
    echo "=== Installing on $dev ==="
    adb -s "$dev" install -r build/GeoSrbija.apk
    adb -s "$dev" shell am start -n rs.geosrbija/.MainActivity
done
