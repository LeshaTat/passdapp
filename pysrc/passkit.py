import msgpack
import base64
from algosdk import constants, encoding
from algosdk.future import transaction
from pysrc.config import algod_client, indexer_client
import hashlib

def secret_iterate(passwd, k):
  i = 0
  h = passwd
  while i<k:
    m = hashlib.sha256()
    m.update(h)
    h = m.digest()
    i = i+1
  return h

def get_bytes_txid_raw(tx):
  txn = encoding.msgpack_encode(tx)
  to_sign = constants.txid_prefix + base64.b64decode(txn)
  txid = encoding.checksum(to_sign)
# Diff vs tx.get_txid() - exclude following lines
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

def load_lsigs(app_id: int, passwd: str, k: int):
  note_prefix = secret_iterate(passwd, k)
  txs = indexer_client.search_transactions(
    txn_type="appl",
    note_prefix=note_prefix,
    application_id=app_id
  )

  tx_note = None
  for tx in reversed(txs["transactions"]):
    if "note" not in tx:
      continue;
    tx_note = base64.b64decode(tx["note"])
    if tx_note.startswith(note_prefix):
      break
    tx_note = None
  if tx_note is None:
    print("Credentials not found")
    return None
  
  note = tx_note[len(note_prefix):]
  return decodeLSigs(note)

def prepare(appId, lsigs, secret, mark):
  params = algod_client.suggested_params()
  params.fee = 1000
  params.flat_fee = True
  txn = transaction.ApplicationNoOpTxn(
    lsigs["address"], params, appId, 
    ["prepare", secret, mark]
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

  def reload(self):
    self.smart.read_local_state()
    self.k = loadK(self.smart)

  def gen_tx_confirm(self):
    return confirm(
      self.smart.id,
      self.lsigs,
      secret_iterate(self.passwd, self.get_prepare_k()-2)
    )

  def gen_mark(self, confirm_tx: transaction.LogicSigTransaction):
    return get_bytes_txid_raw(confirm_tx.transaction)
  
  def check_mark_before_prepare(self):
    self.smart.read_local_state()
    return self.smart.get_local_state_bytes("mark") == b""

  def check_mark_after_prepare(self, mark):
    self.smart.read_local_state()
    return self.smart.get_local_state_bytes("mark") == mark

  def get_prepare_k(self):
    dk = self.k%3
    if dk==0: dk=3
    return self.k-dk

  def gen_tx_prepare(self, mark):
    secret_prepare = secret_iterate(self.passwd, self.get_prepare_k())
    return prepare(
      self.smart.id,
      self.lsigs,
      secret_prepare, 
      mark
    )
  
  def gen_cancel(self):
    return cancel(self.smart.id, self.lsigs, secret_iterate(self.passwd, self.k-1))

  def sign_tx(self, tx, confirm_pos):
    lsig = self.lsigs["confirmTxn"]
    lsig.args = [(confirm_pos).to_bytes(8, 'big')]
    return transaction.LogicSigTransaction(tx, lsig)

def sendCancel(smart, lsigs, passwd, k):
  smart.read_local_state()
  k = loadK(smart)

def setup(smart, lsigs, passwd, k):
  smart.read_local_state()
  secret = secret_iterate(passwd, k)
  smart.call(
    [
      "setup", 
      secret,
      k.to_bytes(8, 'big')
    ],
    secret+encodeLSigs(lsigs)
  )

def pbkdf2_hash_password(salt, passwd, iterations_count):  
  salt = base64.b64decode(salt.encode("UTF8"))
  return hashlib.pbkdf2_hmac('sha256', passwd.encode("UTF8"), salt, iterations_count)