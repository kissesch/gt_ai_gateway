import os
import glob
import subprocess
import sys
import shlex
import shutil

def run_command(command):
    shell_command = ' '.join(shlex.quote(str(s)) for s in command)
    print(f"🚀 Executing: {shell_command}")
    process = subprocess.Popen(shell_command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in iter(process.stdout.readline, ''):
        print(line, end='')
    process.stdout.close()
    return_code = process.wait()
    if return_code != 0:
        print(f"❌ Error: Command failed with code {return_code}", file=sys.stderr)
        sys.exit(return_code)

def main():
    # Change working directory to the script's directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    # 1. Setup paths
    bundle_dir = "../build/target/aarch64-apple-darwin/release/bundle"
    macos_dir = os.path.join(bundle_dir, "macos")
    
    apps = glob.glob(os.path.join(macos_dir, "*.app"))
    if not apps:
        print(f"❌ Error: No .app found in {macos_dir}")
        sys.exit(1)
    
    app_path = apps[0]
    app_name = os.path.basename(app_path)
    
    cert_name = os.environ.get("APPLE_SIGNING_IDENTITY")
    apple_id = os.environ.get("APPLE_ID")
    apple_password = os.environ.get("APPLE_PASSWORD")
    apple_team_id = os.environ.get("APPLE_TEAM_ID")
    
    if not cert_name:
        print("❌ Error: APPLE_SIGNING_IDENTITY not set. Skipping signing.")
        sys.exit(1)
        
    entitlements_path = "entitlements.mac.plist"
    if not os.path.exists(entitlements_path):
        print(f"❌ Error: {entitlements_path} not found!")
        sys.exit(1)
    
    # 2. Deep sign the app
    # 2.1 First, sign the sidecar and any frameworks explicitly just in case
    backend_path = os.path.join(app_path, "Contents", "MacOS", "ai-gateway-backend")
    if os.path.exists(backend_path):
        print("\n--- Signing backend sidecar explicitly ---")
        run_command(["codesign", "--force", "--options=runtime", "--entitlements", entitlements_path, "--sign", cert_name, backend_path])
        
    # 2.2 Sign framework dylibs if any
    frameworks_dir = os.path.join(app_path, "Contents", "Frameworks")
    if os.path.exists(frameworks_dir):
        print("\n--- Signing frameworks explicitly ---")
        for root, dirs, files in os.walk(frameworks_dir):
            for file in files:
                if file.endswith(".dylib") or file.endswith(".framework"):
                    fpath = os.path.join(root, file)
                    run_command(["codesign", "--force", "--options=runtime", "--sign", cert_name, fpath])

    print("\n--- Signing the main app bundle ---")
    run_command(["codesign", "--deep", "--force", "--options=runtime", "--entitlements", entitlements_path, "--sign", cert_name, app_path])
    
    # Verify signature
    print("\n--- Verifying signature ---")
    run_command(["codesign", "--verify", "--deep", "--strict", "--verbose=2", app_path])
    
    # 3. Create DMG
    dmg_out_dir = os.path.join(bundle_dir, "signed_dmg")
    os.makedirs(dmg_out_dir, exist_ok=True)
    
    # Copy app to a temporary directory to create a clean DMG
    dmg_tmp_dir = os.path.join(dmg_out_dir, "dmg_tmp")
    if os.path.exists(dmg_tmp_dir):
        shutil.rmtree(dmg_tmp_dir)
    os.makedirs(dmg_tmp_dir, exist_ok=True)
    
    # Create an Applications symlink in the DMG for easy installation
    os.symlink("/Applications", os.path.join(dmg_tmp_dir, "Applications"))
    shutil.copytree(app_path, os.path.join(dmg_tmp_dir, app_name), symlinks=True)
    
    dmg_name = app_name.replace(".app", ".dmg")
    dmg_path = os.path.join(dmg_out_dir, dmg_name)
    
    if os.path.exists(dmg_path):
        os.remove(dmg_path)
        
    print(f"\n--- Creating DMG: {dmg_path} ---")
    run_command(["hdiutil", "create", "-volname", app_name.replace(".app", ""), "-srcfolder", dmg_tmp_dir, "-ov", "-format", "UDBZ", dmg_path])
    
    # Clean up temp dir
    shutil.rmtree(dmg_tmp_dir)
    
    # Sign the DMG
    print("\n--- Signing DMG ---")
    run_command(["codesign", "--force", "--sign", cert_name, dmg_path])
    
    # 4. Notarize
    if apple_id and apple_password and apple_team_id:
        print("\n--- Submitting to Apple Notary Service ---")
        run_command([
            "xcrun", "notarytool", "submit", dmg_path, 
            "--apple-id", apple_id, 
            "--password", apple_password, 
            "--team-id", apple_team_id, 
            "--wait"
        ])
        
        print("\n--- Stapling ticket ---")
        run_command(["xcrun", "stapler", "staple", dmg_path])
    else:
        print("\n⚠️ Warning: APPLE_ID, APPLE_PASSWORD, or APPLE_TEAM_ID missing. Skipping notarization.")
        
    print(f"\n✅ Success! Final DMG located at: {dmg_path}")

if __name__ == "__main__":
    main()
