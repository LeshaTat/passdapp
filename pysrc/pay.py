from .transaction import send_transaction
from .config import algod_client
from algosdk import transaction

def payTxn(acFromAddr, acToAddr, amount):  
  account_public_key = acFromAddr
  params = algod_client.suggested_params()

  gh = params.gh
  first_valid_round = params.first
  last_valid_round = params.last
  fee = params.min_fee
  send_amount = amount

  existing_account = account_public_key
  send_to_address = acToAddr

  tx = transaction.PaymentTxn(
      existing_account, 
      fee, 
      first_valid_round, 
      last_valid_round, 
      gh, 
      send_to_address, 
      send_amount, 
      flat_fee=True
  )
  return tx

def pay(acFrom, acTo, amount):  
  account_private_key = acFrom.private
  signed_tx = payTxn(acFrom.address, acTo.address, amount).sign(account_private_key)
  send_transaction(signed_tx)
