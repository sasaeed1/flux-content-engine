"""One-shot: install local ed25519 pubkey into root@server's authorized_keys.

Used because winget/choco GitHub CLI installs need admin on this Windows box,
and the existing wappflow_hetzner key isn't yet trusted on this server.

Run once with the root password; subsequent SSH is keyed.
"""
import sys
import paramiko
from pathlib import Path

HOST = "78.47.224.70"
USER = "root"
PASSWORD = sys.argv[1] if len(sys.argv) > 1 else None
PUB_KEY = Path.home() / ".ssh" / "wappflow_hetzner.pub"

if not PASSWORD:
    sys.exit("usage: install_key.py <root_password>")
if not PUB_KEY.exists():
    sys.exit(f"missing: {PUB_KEY}")

pub = PUB_KEY.read_text().strip()
print(f"Installing key: {pub[:60]}...")

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASSWORD, timeout=20, allow_agent=False, look_for_keys=False)

cmd = (
    "mkdir -p ~/.ssh && chmod 700 ~/.ssh && "
    f"grep -qxF '{pub}' ~/.ssh/authorized_keys 2>/dev/null || echo '{pub}' >> ~/.ssh/authorized_keys && "
    "chmod 600 ~/.ssh/authorized_keys && "
    "echo INSTALLED && wc -l ~/.ssh/authorized_keys"
)
stdin, stdout, stderr = c.exec_command(cmd)
print("STDOUT:", stdout.read().decode().strip())
err = stderr.read().decode().strip()
if err:
    print("STDERR:", err)
c.close()
print("done.")
