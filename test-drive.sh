#!/bin/bash
# Set these in your environment or .env before running:
# GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT
: "${GOOGLE_CLIENT_ID:?GOOGLE_CLIENT_ID must be set}"
: "${GOOGLE_CLIENT_SECRET:?GOOGLE_CLIENT_SECRET must be set}"
: "${GOOGLE_REFRESH_TOKEN:?GOOGLE_REFRESH_TOKEN must be set}"
: "${GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT:?GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT must be set}"
node api/_lib/_test-drive-share.js butterchicken5421@gmail.com
