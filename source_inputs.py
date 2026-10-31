"""Locate the SHA-locked canonical art inputs included in this repository."""
from pathlib import Path
import os

def input_root():
    root=Path(os.environ.get('DCP_SOURCE_INPUTS',Path(__file__).resolve().parent/'source')).expanduser().resolve()
    if not root.is_dir():raise SystemExit('Canonical source input directory does not exist.')
    return root
