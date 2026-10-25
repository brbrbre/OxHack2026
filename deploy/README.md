# deploy/ - the live demo on Vultr

Live: https://95.179.232.47.sslip.io (also http://95.179.232.47).

## What runs where

- **Server:** Vultr cloud compute in London, Ubuntu 24.04. A region outside the US, because Binance blocks some US IPs.
- **App:** one `uvicorn api.main:app` process on `127.0.0.1:8000`, run by the systemd service `horizon` as user `horizon`. It serves the API and the built React app (`app/dist`).
- **HTTPS:** Caddy in front, on ports 80 and 443, with a free Let's Encrypt certificate for `95.179.232.47.sslip.io`. sslip.io resolves that name to the server's IP, so no domain is needed.
- **Why HTTPS matters:** iPhones try `https://` first when a link is opened from WhatsApp. Without port 443 the page hangs on a blank screen.
- **Firewall:** `ufw` allows 22, 80 and 443.

## Service settings

The API key file is `/home/horizon/app/.env` (mode 600, never in git). Demo settings go in a systemd drop-in:

```ini
[Service]
Environment=PUBLIC_URL=https://95.179.232.47.sslip.io
Environment=HABITO_DEMO=1
Environment=HABITO_ESPERA_MIN=2
Environment=HABITO_AUTO=1
```

`HABITO_ESPERA_MIN=2` makes the reminder call after 2 minutes instead of a day, so the habit can be shown on stage.

## Caddyfile

```
95.179.232.47.sslip.io {
	reverse_proxy 127.0.0.1:8000
}

http://95.179.232.47 {
	reverse_proxy 127.0.0.1:8000
}
```

## Deploy a new version

```bash
cd /home/horizon/app
sudo -u horizon git pull
sudo -u horizon bash -c "cd app && npm ci && npm run build"   # only if app/ changed
systemctl restart horizon
```

Then check: `curl -s -o /dev/null -w "%{http_code}" https://95.179.232.47.sslip.io/api/assets` returns 200.
