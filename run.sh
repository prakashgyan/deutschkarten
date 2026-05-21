#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-47291}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="deutschkarten"
SERVICE_FILE="${DIR}/${SERVICE_NAME}.service"
CURRENT_USER="$(whoami)"

# ── Generate systemd service file ─────────────────────────────────────────────
cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=DeutschKarten German Flashcard App
After=network.target

[Service]
Type=simple
User=${CURRENT_USER}
WorkingDirectory=${DIR}
ExecStart=/usr/bin/python3 -m http.server ${PORT} --bind 0.0.0.0
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "✅  Service file created: ${SERVICE_FILE}"
echo ""
echo "To enable autostart, run:"
echo "  sudo cp ${SERVICE_FILE} /etc/systemd/system/${SERVICE_NAME}.service"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable ${SERVICE_NAME}"
echo "  sudo systemctl start ${SERVICE_NAME}"
echo ""
echo "  Status:  sudo systemctl status ${SERVICE_NAME}"
echo "  Logs:    sudo journalctl -u ${SERVICE_NAME} -f"
echo ""
echo "🚀  Starting server at http://0.0.0.0:${PORT} ..."
echo "    (override port with: PORT=9000 ./run.sh)"
echo ""

exec python3 -m http.server "${PORT}" --bind 0.0.0.0
