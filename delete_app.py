from pysrc.smart import Smart
from pysrc.passdapp import get_app, load_app
from pysrc.config import developer

app = get_app()
smart = Smart(sender = developer)
d = load_app()
smart.id = d["appId"]
smart.delete()
