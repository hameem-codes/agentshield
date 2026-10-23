"""
Vercel entrypoint for AgentShield FastAPI backend.
"""

import sys
import os
from pathlib import Path

# Add src to sys.path so agentshield package is discoverable
root_path = Path(__file__).resolve().parent.parent
src_path = root_path / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

# Ensure VERCEL environment is recognized for /tmp ephemeral DB storage
if "VERCEL" not in os.environ:
    os.environ["VERCEL"] = "1"

from agentshield.api.app import app
