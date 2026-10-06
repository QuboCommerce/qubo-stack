# Customer VPS runbook

One VPS per customer. Two humans-with-shells, nothing else:

| User | Purpose | Sudo | Docker |
| --- | --- | --- | --- |
| `qubo` | Owns everything Qubo: `/home/qubo/qubo-stack`, `.env`, compose state, Coolify. The only account automation touches. | yes | yes |
| `ali` | Personal: poking around, scratch work. Never owns a deployment. | yes | yes |

Deploys do **not** log in over SSH. Coolify pulls from GitHub and rebuilds, so there is no
"deploy" user and nothing in `~/.ssh` that a pipeline depends on. Root login stays key-only
(Coolify uses it for the local server) and passwords are off everywhere.

Replace `SERVER_IP` and paste blocks one at a time.

## 1. First login and base system (as the image's default user, e.g. `ubuntu`)

```sh
ssh ubuntu@SERVER_IP
sudo apt update && sudo apt full-upgrade -y && sudo apt autoremove -y
sudo timedatectl set-timezone Europe/Brussels
sudo reboot
```

## 2. Docker

```sh
ssh ubuntu@SERVER_IP
curl -fsSL https://get.docker.com | sudo sh
```

## 3. Users

```sh
sudo adduser --disabled-password --gecos "Qubo service account" qubo
sudo adduser --disabled-password --gecos "Ali" ali
sudo usermod -aG sudo,docker qubo
sudo usermod -aG sudo,docker ali
sudo passwd qubo      # needed once for sudo; store it in your password manager
sudo passwd ali
```

Keys: on **your machine** (the dev VPS and/or your PC) run `cat ~/.ssh/id_ed25519.pub` (or
`id_rsa.pub`) and paste the line into the heredocs below.

```sh
for u in qubo ali; do
  sudo install -d -m 700 -o $u -g $u /home/$u/.ssh
  sudo tee /home/$u/.ssh/authorized_keys >/dev/null <<'EOF'
ssh-ed25519 AAAA... you@dev-vps
ssh-rsa AAAA... you@pc
EOF
  sudo chown $u:$u /home/$u/.ssh/authorized_keys && sudo chmod 600 /home/$u/.ssh/authorized_keys
done
```

## 4. Harden SSH

```sh
sudo tee /etc/ssh/sshd_config.d/90-qubo.conf >/dev/null <<'EOF'
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers root qubo ali
EOF
sudo sshd -t && sudo systemctl restart ssh
```

Open a **second** terminal and confirm `ssh qubo@SERVER_IP` works before closing the first.
Then remove the image user: `sudo deluser --remove-home ubuntu` (from `qubo`).

## 5. Firewall

```sh
sudo apt install -y ufw
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
```

Port 8000 (Coolify UI) stays closed; reach it through an SSH tunnel (step 6).

## 6. Coolify (as `qubo`)

```sh
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

Then from your machine: `ssh -N -L 8000:127.0.0.1:8000 qubo@SERVER_IP` and open
http://localhost:8000 to create the admin account.

**Edge conflict.** Coolify starts its own Traefik on 80/443. A box that already runs an edge
(Mostapha's `wooster-traefik` for tailg.be) must pick one:

- *Coolify owns the edge* (target): Server → Proxy → Traefik; move existing routes into Coolify
  (each app gets its domain in the UI, certificates follow). Stop the old proxy first:
  `docker stop wooster-traefik`.
- *Keep the old edge for now*: Server → Proxy → **None** before anything deploys, and keep
  using `docker-compose.traefik.yml`-style labels against the existing network.

**Qubo routes.** Qubo does not use per-app domains in Coolify. Its API publishes every
verified domain as Traefik dynamic config, and Coolify's Traefik polls it. In Server → Proxy →
Configuration, add to the Traefik `command:` list and restart the proxy:

```yaml
- '--providers.http.endpoint=http://qubo-elysia:3333/v1/edge/traefik?token=<QUBO_EDGE_TOKEN>'
- '--providers.http.pollInterval=10s'
```

The proxy must reach the API container: put `qubo-elysia` on the `coolify` network (or use
the name Coolify gives it). Match the instance env to the proxy: `QUBO_EDGE_ENTRYPOINT_HTTP`
and `_HTTPS` (Coolify: `http`, `https`), `QUBO_EDGE_CERT_RESOLVER` (Coolify: `letsencrypt`),
`QUBO_EDGE_ADMIN_URL` and `QUBO_EDGE_STOREFRONT_URL` (the containers as the proxy sees them).
Set `QUBO_SERVER_IP` to the public IP customers must point their A record at.

Before any domain is verified the admin answers on `qubo.<ip-with-dashes>.sslip.io`. Then add
a domain in Settings → Domains and follow the records it lists; it goes live on its own.

Without Coolify, `docker compose --profile edge up -d` starts the same Traefik (`qubo-edge`,
needs `ACME_EMAIL`).

Add the dev-VPS ssh alias to your notes:

```
Host <customer>
  HostName SERVER_IP
  User qubo
  IdentityFile ~/.ssh/id_ed25519
```

## 7. Checkout (only needed without Coolify, or for `.env` and ops)

```sh
sudo -u qubo -i
git clone git@github.com:aliaddas/qubo-stack.git ~/qubo-stack   # deploy key: ssh-keygen -t ed25519 -C "qubo@$(hostname)"
```

## Routine

| Need | Command |
| --- | --- |
| Shell | `ssh qubo@SERVER_IP` |
| Coolify UI | `ssh -N -L 8000:127.0.0.1:8000 qubo@SERVER_IP` → http://localhost:8000 |
| Logs | `docker compose logs -f --tail 100` in the checkout, or Coolify → app → Logs |
| Disk | `df -h / && docker system df` ; `docker image prune -f` |
| Updates | `sudo apt update && sudo apt full-upgrade -y` ; reboot in a quiet hour |
