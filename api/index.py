"""
Vercel entrypoint for AgentShield FastAPI backend.
"""

import sys
from pathlib import Path

# Add src to sys.path so agentshield package is discoverable
root_path = Path(__file__).resolve().parent.parent
src_path = root_path / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

from agentshield.api.app import app
