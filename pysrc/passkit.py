import msgpack
from pysrc.transaction import send_transaction
import base64
from algosdk import constants, encoding
from algosdk.future import transaction
from pysrc.config import algod_client, indexer_client
import hashlib

def hash_custom(str):
  h = hashlib.sha256(str).digest()
  return h

def secret_custom(str):
  return hash_custom(str.encode("utf-8"))

def secret_note(passwd, id):
  return secret_custom(passwd+"#"+str(id)+"#note")

def secret(passwd, id, k, step):
#  return hashlib.sha256(2*(passwd+"#"+str(id)+"#"+str(k) + "#"+str(step)).encode("utf-8")).digest()
  return base64.b64encode(secret_custom(passwd+"#"+str(id)+"#"+str(k)+"#"+str(step)))

def hash_secret(passwd, id, k, step):
  h = hash_custom(secret(passwd, id, k, step))
  return h

def get_bytes_txid_raw(tx):
  txn = encoding.msgpack_encode(tx)
  to_sign = constants.txid_prefix + base64.b64decode(txn)
  txid = encoding.checksum(to_sign)
# Unlike tx.get_txid() do not execute following lines:
#  txid = base64.b32encode(txid).decode()
#  return encoding._undo_padding(txid)
  return txid

def loadK(smart):
  return smart.get_local_state_int("counter")

def makeLSig(private, compiled):
  lsig = transaction.LogicSig(base64.decodebytes(compiled.encode()))
  lsig.sign(private)
  return lsig

def make_lsigs(account, d):
  return {
    "address": account.address,
    "prepare": makeLSig(account.private, d["prepare"]),
    "confirm": makeLSig(account.private, d["confirm"]),
    "confirmTxn": makeLSig(account.private, d["confirmTxn"]),
    "cancel": makeLSig(account.private, d["cancel"])
  }

def packLSig(lsig):
  return msgpack.packb(lsig.dictify())

def encodeLSigs(lsigs):
  return msgpack.packb({
    "address": lsigs["address"],
    "prepare": packLSig(lsigs["prepare"]),
    "confirm": packLSig(lsigs["confirm"]),
    "confirmTxn": packLSig(lsigs["confirmTxn"]),
    "cancel": packLSig(lsigs["cancel"])
  }, use_bin_type=True)

def unpackLSig(packed):
  return transaction.LogicSig.undictify(msgpack.unpackb(packed, raw=False))

def decodeLSigs(msg):
  obj = msgpack.unpackb(msg, raw=False)
  return {
    "address": obj["address"],
    "prepare": unpackLSig(obj["prepare"]),
    "confirm": unpackLSig(obj["confirm"]),
    "confirmTxn": unpackLSig(obj["confirmTxn"]),
    "cancel": unpackLSig(obj["cancel"])
  }

def load_lsigs(app_id: int, passwd: str):
  notePrefix = secret_note(passwd, app_id)
  tx = indexer_client.search_transactions(
    txn_type="appl",
    note_prefix=secret_note(passwd, app_id),
    application_id=app_id
  )
  note = base64.b64decode(tx["transactions"][len(tx["transactions"])-1]["note"])[len(notePrefix):]
  return decodeLSigs(note)

def prepare(appId, lsigs, secret, nsecret1, nsecret2, nsecret3, mark):
  params = algod_client.suggested_params()
  params.fee = 1000
  params.flat_fee = True
  txn = transaction.ApplicationNoOpTxn(
    lsigs["address"], params, appId, 
    ["prepare", secret, nsecret1, nsecret2, nsecret3, mark]
  )
  return transaction.LogicSigTransaction(txn, lsigs["prepare"])

def confirm(appId, lsigs, secret):
  params = algod_client.suggested_params()
  params.fee = 1000
  params.flat_fee = True
  txn = transaction.ApplicationNoOpTxn(
    lsigs["address"], params, appId, 
    ["confirm", secret]
  )
  return transaction.LogicSigTransaction(txn, lsigs["confirm"])

def cancel(appId, lsigs, secret):
  params = algod_client.suggested_params()
  params.fee = 1000
  params.flat_fee = True
  txn = transaction.ApplicationNoOpTxn(
    lsigs["address"], params, appId, 
    ["cancel", secret]
  )
  return transaction.LogicSigTransaction(txn, lsigs["cancel"])

class TransactionByPasswd:  
  def __init__(self, smart, lsigs, passwd):
    self.smart = smart
    smart.read_local_state()
    self.k = loadK(smart)
    self.lsigs = lsigs
    self.passwd = passwd

  def gen_tx_confirm(self):
    return confirm(
      self.smart.id,
      self.lsigs,
      secret(self.passwd, self.smart.id, self.k-1, "confirm")
    )

  def gen_stamp(self, confirm_tx: transaction.LogicSigTransaction):
    return (      
      hash_secret(self.passwd, self.smart.id, self.k, "prepare"),
      hash_secret(self.passwd, self.smart.id, self.k, "confirm"),
      hash_secret(self.passwd, self.smart.id, self.k, "cancel"),
      get_bytes_txid_raw(confirm_tx.transaction)
    )
  
  def check_stamp_after_prepare(self, stamp):
    self.smart.read_local_state()
    return (
      self.smart.get_local_state_bytes("nsecret1"),
      self.smart.get_local_state_bytes("nsecret2"),
      self.smart.get_local_state_bytes("nsecret3"),
      self.smart.get_local_state_bytes("nmark"),
    ) == stamp

  def gen_tx_prepare(self, stamp):
    (
      hash_secret_next_prepare, 
      hash_secret_next_confirm,
      hash_secret_next_cancel,
      mark
    ) = stamp
    hash_secret_next_cancel = hash_secret(self.passwd, self.smart.id, self.k, "cancel")
    secret_prepare = secret(self.passwd, self.smart.id, self.k-1, "prepare")
    return prepare(
      self.smart.id,
      self.lsigs,
      secret_prepare, 
      hash_secret_next_prepare, 
      hash_secret_next_confirm,
      hash_secret_next_cancel,
      mark
    )

  def sign_tx(self, tx, confirm_pos):
    lsig = self.lsigs["confirmTxn"]
    lsig.args = [(confirm_pos).to_bytes(8, 'big')]
    return transaction.LogicSigTransaction(tx, lsig)

  

def transaction_by_passwd(smart, lsigs, passwd, tx):
  smart.read_local_state()
  k = loadK(smart)

  tx_confirm = confirm(
    smart.id,
    lsigs,
    secret(passwd, smart.id, k-1, "confirm")
  )

  group_id = transaction.calculate_group_id([tx, tx_confirm.transaction])
  tx_confirm.transaction.group = group_id
  tx.group = group_id
  tx_prepare = prepare(
    smart.id,
    lsigs,
    secret(passwd, smart.id, k-1, "prepare"),
    hash_secret(passwd, smart.id, k, "prepare"),
    hash_secret(passwd, smart.id, k, "confirm"),
    hash_secret(passwd, smart.id, k, "cancel"),
    get_bytes_txid_raw(tx_confirm.transaction)
  )
  lsig = lsigs["confirmTxn"]
  lsig.args = [(1).to_bytes(8, 'big')]
  tx_signed = transaction.LogicSigTransaction(tx, lsig)
  return [tx_signed, tx_prepare, tx_confirm]

def sendCancel(smart, lsigs, passwd):
  smart.read_local_state()
  k = loadK(smart)
  cancelTxn = cancel(smart.id, lsigs, secret(passwd, smart.id, k-2, "cancel"))
  print("cancel")
  send_transaction(cancelTxn)

#testPay()

def setup(smart, lsigs, passwd):
  smart.read_local_state()
  k = loadK(smart)
  smart.call(
    [
      "setup", 
      hash_secret(passwd, smart.id, k, "prepare"),
      hash_secret(passwd, smart.id, k, "confirm"),
      hash_secret(passwd, smart.id, k, "cancel")
    ],
    secret_note(passwd, smart.id)+encodeLSigs(lsigs)
  )

#print(json.dumps(encoding.msgpack_decode(note), indent=2))
