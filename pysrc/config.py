import yaml
import os
from pathlib import Path
from pysrc.account import Account
from algosdk.v2client import algod, indexer

developer = Account().generate()

algod_client = None
indexer_client = None

path = Path(os.path.dirname(__file__))
config_location = os.path.join(path.parent, "config.yml")

def load_config():
  try:
    with open(config_location) as file:
      return yaml.full_load(file)
  except:
    return None

# token_key: str, token_value: str, algod_address: str, indexer_address: str
def gen_config(**client): 
  config = {
    "client_credentials": client,
    "developer_credentials": developer.toDict()
  }  

  with open(config_location, 'w') as f:
    yaml.dump(config, f, default_flow_style=False)

def gen_config_sandbox():
  gen_config(
    token_key = "X-Algo-API-Token", 
    token_value = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 
    algod_address = "http://localhost:4001", 
    indexer_address = "http://localhost:8980"
  )

def gen_config_purestake(token: str):
  gen_config(**{
    "token_key": "X-Api-key", 
    "token_value": token, 
    "algod_address": "https://testnet-algorand.api.purestake.io/ps2", 
    "indexer_address": "https://testnet-algorand.api.purestake.io/idx2"
  })

config = load_config()

if config!=None:
  configClient = config["client_credentials"]
  algod_address_ps2 = configClient["algod_address"]
  algod_address_idx2 = configClient["indexer_address"]
  token = dict([
    [configClient["token_key"], configClient["token_value"]]
  ])

  developer = Account().fromDict(config["developer_credentials"])
  algod_client = algod.AlgodClient(configClient["token_value"], algod_address_ps2, token)
  indexer_client = indexer.IndexerClient(configClient["token_value"], algod_address_idx2, token)
