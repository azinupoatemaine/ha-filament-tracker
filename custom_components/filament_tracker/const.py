DOMAIN = "filament_tracker"

STORAGE_KEY = "filament_tracker_spools"
STORAGE_VERSION = 2

SERVICE_ADD_SPOOL = "add_spool"
SERVICE_DELETE_SPOOL = "delete_spool"
SERVICE_UPDATE_SPOOL = "update_spool"
SERVICE_SET_SLOT_MAPPING = "set_slot_mapping"

SIGNAL_SPOOLS_UPDATED = f"{DOMAIN}_updated"

DEFAULT_LOW_STOCK_THRESHOLD = 100.0
OPT_LOW_STOCK_THRESHOLD = "low_stock_threshold"

# Bump this whenever the card JS changes. It is used as the ?v= cache-buster in
# the module URL, and (because the old static handler served the file with a
# one-month Cache-Control) it is the only reliable way to force browsers to
# re-fetch the card.
CARD_VERSION = "13"
CARD_URL_PATH = f"/{DOMAIN}_frontend"
CARD_FILENAME = "filament-tracker-card.js"

# Auto-discovery: any ha-bambulab printer exposes sensors shaped like
# sensor.<prefix>_ams_<unit>_tray_<slot> and sensor.<prefix>_external_spool.
# We never ask the user for their printer's entity prefix — we find it by
# pattern-matching whatever's already in the state machine.
AMS_TRAY_RE = r"^sensor\.(.+)_ams_(\d+)_tray_(\d+)$"
EXTERNAL_SPOOL_SUFFIX = "_external_spool"
CURRENT_STAGE_SUFFIX = "_current_stage"
PRINT_WEIGHT_SUFFIX = "_print_weight"
