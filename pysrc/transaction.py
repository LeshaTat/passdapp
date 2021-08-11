from .config import algod_client

def wait_for_confirmation(txid, wait_for_next_round=False):
  # Wait for the next round to give state time to update
  last_round = algod_client.status().get('last-round')
  txinfo = algod_client.pending_transaction_info(txid)
  while not (txinfo.get('confirmed-round') and txinfo.get('confirmed-round') > 0):
      print('Waiting for confirmation')
      last_round += 1
      algod_client.status_after_block(last_round)
      txinfo = algod_client.pending_transaction_info(txid)
  print('Transaction confirmed in round', txinfo.get('confirmed-round'))

  if wait_for_next_round:
    print('Waiting for current block to be assimilated')
    last_round = algod_client.status().get('last-round')
    algod_client.status_after_block(last_round+1)
  return txinfo

def send_transaction(signed_tx, **kwargs):
  tx_info = None
  try:
      tx_confirm = algod_client.send_transaction(signed_tx)
      print('Transaction sent with ID', signed_tx.transaction.get_txid())
      tx_info = wait_for_confirmation(tx_confirm, **kwargs)
  except Exception as e:
      print(e)
  return tx_info

def send_transactions(signed_txs, **kwargs):
  tx_info = None
  try:
      tx_confirm = algod_client.send_transactions(signed_txs)
      print('Transactions sent with ID', tx_confirm)
      tx_info = wait_for_confirmation(tx_confirm, **kwargs)
  except Exception as e:
      print(e)
  return tx_info


