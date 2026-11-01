# usage: python odt-update-index.py <in.odt> <out.odt>
#
# Helper of docs/build-manual.php --update-index. Opens the document in a private headless
# LibreOffice, updates every index (the table of contents, so it gets its page numbers) and
# saves it as ODT. Nothing else is touched. Run it with LibreOffice's own Python
# (program/python.exe on Windows), which carries the `uno` module.
import os
import subprocess
import sys
import tempfile
import time

import uno
from com.sun.star.beans import PropertyValue


def pv(name, value):
    p = PropertyValue()
    p.Name = name
    p.Value = value
    return p


src, dst = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
profile = "file:///" + os.path.join(tempfile.gettempdir(), "sc-odt-profile").replace("\\", "/")
soffice = os.environ.get("SOFFICE") or os.path.join(
    os.path.dirname(sys.executable), "soffice.exe" if os.name == "nt" else "soffice")
port = 2013

proc = subprocess.Popen(
    [soffice, "--headless", "--norestore", "--nologo", "-env:UserInstallation=" + profile,
     "--accept=socket,host=localhost,port=%d;urp;" % port],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

try:
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
    ctx = None
    for _ in range(90):
        try:
            ctx = resolver.resolve("uno:socket,host=localhost,port=%d;urp;StarOffice.ComponentContext" % port)
            break
        except Exception:
            time.sleep(1)
    if ctx is None:
        raise SystemExit("LibreOffice did not start")

    desktop = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
    doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(src), "_blank", 0, (pv("Hidden", True),))
    indexes = doc.getDocumentIndexes()
    n = indexes.getCount()
    for i in range(n):
        indexes.getByIndex(i).update()
    doc.storeToURL(uno.systemPathToFileUrl(dst), (pv("FilterName", "writer8"),))
    doc.close(True)
    print("indexes updated: %d" % n)
    try:
        desktop.terminate()
    except Exception:
        pass
finally:
    try:
        proc.wait(timeout=30)
    except Exception:
        proc.kill()
