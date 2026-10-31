"""Locate user-supplied local art inputs without distributing their contents."""
from pathlib import Path
import os
def input_root():
 value=os.environ.get('DCP_PRIVATE_INPUTS')
 if not value:raise SystemExit('Set DCP_PRIVATE_INPUTS to your local private-input directory.')
 root=Path(value).expanduser().resolve()
 if not root.is_dir():raise SystemExit('DCP_PRIVATE_INPUTS is not a directory.')
 return root
