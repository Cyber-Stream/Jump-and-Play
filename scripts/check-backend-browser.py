"""Compatibility entry point for the contact form's current direct WhatsApp flow."""
from pathlib import Path
import subprocess, sys
root = Path(__file__).resolve().parents[1]
node = 'C:/Program Files/nodejs/node.exe'
raise SystemExit(subprocess.call([node, str(root/'scripts/check-whatsapp-direct.cjs'), *sys.argv[1:]], cwd=root))
