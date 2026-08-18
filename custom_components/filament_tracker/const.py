DOMAIN = "filament_tracker"

STORAGE_KEY = "filament_tracker_spools"
STORAGE_VERSION = 1

SERVICE_ADD_SPOOL = "add_spool"
SERVICE_DELETE_SPOOL = "delete_spool"
SERVICE_UPDATE_SPOOL = "update_spool"

SIGNAL_SPOOLS_UPDATED = f"{DOMAIN}_updated"

DEFAULT_LOW_STOCK_THRESHOLD = 100.0

AMS_MAPPING_ENTITIES = [f"input_select.ams_manual_slot_{i}_mapping" for i in range(1, 5)]
NONE_OPTION = "None / RFID auto-tracked"

CARD_VERSION = "1"
CARD_URL_PATH = f"/{DOMAIN}_frontend"
CARD_FILENAME = "filament-tracker-card.js"
