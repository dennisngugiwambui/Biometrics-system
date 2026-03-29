import sys
import traceback

services = [
    ("school_service", "school_service.core.config"),
    ("device_service", "device_service.core.config"),
    ("attendance_service", "attendance_service.core.config"),
    ("notification_service", "notification_service.core.config"),
    ("api_gateway", "api_gateway.core.config"),
]

all_ok = True
for name, module_path in services:
    try:
        mod = __import__(module_path, fromlist=["settings"])
        s = mod.settings
        print(f"  {name}: OK (DB={s.DATABASE_URL[:40]}...)")
    except Exception as e:
        print(f"  {name}: FAILED - {e}")
        traceback.print_exc()
        all_ok = False

if all_ok:
    print("\nAll service configs loaded successfully!")
else:
    print("\nSome services failed to load config.")
    sys.exit(1)
