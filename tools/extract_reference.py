"""Extract a SHA-verified dependency entry to a user-selected local private directory."""
from pathlib import Path,PurePosixPath
import argparse,hashlib,io,zipfile

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--jar',type=Path,required=True);p.add_argument('--jar-sha256',required=True);p.add_argument('--inner-entry');p.add_argument('--entry',required=True);p.add_argument('--entry-sha256',required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    data=a.jar.read_bytes()
    if hashlib.sha256(data).hexdigest()!=a.jar_sha256:raise SystemExit('Dependency JAR hash mismatch')
    with zipfile.ZipFile(io.BytesIO(data))as z:
        if a.inner_entry:data=z.read(a.inner_entry)
    with zipfile.ZipFile(io.BytesIO(data))as z:data=z.read(a.entry)
    if hashlib.sha256(data).hexdigest()!=a.entry_sha256:raise SystemExit('Entry hash mismatch')
    a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_bytes(data)
    print('Extracted verified local input. Extraction does not grant publication rights.')
if __name__=='__main__':main()
