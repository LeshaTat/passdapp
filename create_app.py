from pysrc.smart import Smart
from pysrc.passdapp import get_app, save_app
from pysrc.config import developer

app = get_app()
smart = Smart(sender = developer).set_app(app)
smart.create()
save_app(smart.id, app)
