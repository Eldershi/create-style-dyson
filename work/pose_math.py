"""Block and pixel matrix helpers for source model exports."""
from pathlib import Path
import hashlib,math
import numpy as np
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def T(x,y,z):
 a=np.eye(4);a[:3,3]=[x,y,z];return a
def R(axis,deg):
 a=math.radians(deg);c=math.cos(a);s=math.sin(a);r=np.eye(4)
 r[:3,:3]={'x':[[1,0,0],[0,c,-s],[0,s,c]],'y':[[c,0,s],[0,1,0],[-s,0,c]],'z':[[c,-s,0],[s,c,0],[0,0,1]]}[axis];return r
def A(axis,deg,p):return T(*p)@R(axis,deg)@T(*[-x for x in p])
def clean(a):return np.where(abs(a)<1e-10,0,a).round(10).tolist()
def matrix_blocks(m):
 b=m.copy();b[:3,3]/=16;return clean(b)
