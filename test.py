import sys
from pysrc.passkit import TransactionByPasswd, load_lsigs, make_lsigs, setup
from pysrc.pay import payTxn
from pysrc.transaction import send_transaction, send_transactions
from algosdk.future import transaction
from pysrc.smart import Smart
from pysrc.account import Account, generateMnemonic
from pysrc.passdapp import load_app
from pysrc.config import developer

a1 = developer
a2 = Account("UMJZ72SRECLFFGJO3SIMW5WTZ4UGQZGARXRD3ZAOICJSIALNWC7M3RW5GQ")

smart = Smart(sender = developer)
d = load_app()
smart.id = d["appId"]

try:
  print("Opt-in")
  smart.opt_in()
  print("Successfully opted-in")
except:
  print("Already opted-in")
  pass

lsigs = make_lsigs(a1, d)

iteratesCount = 1000

passwd = generateMnemonic()
passwd = " ".join(passwd.split()[:4])
print("\nSetup new password: "+passwd)
setup(smart, lsigs, passwd, iteratesCount)


print("\nLoad credentials by password")
lsigs = load_lsigs(smart.id, passwd, iteratesCount)

print("\nSend payment transaction")
px = payTxn(a1.address, a2.address, 110000)
byPasswd = TransactionByPasswd(smart, lsigs, passwd)

send_transaction(byPasswd.gen_cancel(), wait_for_next_round=True)
byPasswd.reload()

# Generate confirmation transaction for each user
tx_confirm = byPasswd.gen_tx_confirm()

# Make transactions group including neccessary confirmation transactions
group_id = transaction.calculate_group_id([px, tx_confirm.transaction])
tx_confirm.transaction.group = group_id
px.group = group_id

# Prepare password-based credentials for confirmation
mark = byPasswd.gen_mark(tx_confirm)

print("Send prepare")
pxt = send_transaction(byPasswd.gen_tx_prepare(mark))

# IMPORTANT! Check if mark in ledger is correct
if not byPasswd.check_mark_after_prepare(mark):
  sys.exit("Contract state check failed. For security reasons you have to do setup again.")
else:
  print("Contract state check passed.")

# Send transactions with confirmations
print("Send confirmation")
pxt = send_transactions([
  # For every password-authenticated transaction specify a position
  # of corresponding confirmation transaction.
  # One confirmation transaction can confirm multiple transactions for one sender
  byPasswd.sign_tx(px, 1), 
  tx_confirm
])

#print("\nClear")
#smart.clear(algod_client)

