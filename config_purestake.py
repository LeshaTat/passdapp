import sys
from pysrc.config import gen_config_purestake

if len(sys.argv)>=2:
  gen_config_purestake(sys.argv[1])
else:
  print("Please provide your purestake API token")
  print("python configPurestake.py <TOKEN>")
