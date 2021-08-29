import base64

from algosdk.future import transaction
from .transaction import send_transaction
from .config import algod_client

class Smart:
  def __init__(self, **param):
    self.param = {}
    self.account = {}
    self.set(**param)
  def set_account(self, name, param):
    if name in param:
      self.param[name] = param[name].address
      self.account[name] = param[name]
  def set_one(self, name, param):
    if name in param:
      self.param[name] = param[name]
  def set(self, **param):
    self.set_account("sender", param)
    self.set_one("approval_program", param)
    self.set_one("clear_program", param)
    self.set_one("global_schema", param)
    self.set_one("local_schema", param)
    return self
  def create(self):
    sender = self.account['sender']
    on_complete = transaction.OnComplete.NoOpOC.real
    params = algod_client.suggested_params()
    params.fee = 1000
    params.flat_fee = True
    txn = transaction.ApplicationCreateTxn(
      sender.address, params, on_complete,
      self.param["approval_program"], 
      self.param["clear_program"],
      self.param["global_schema"], 
      self.param["local_schema"]
    )
    signed_txn = txn.sign(sender.private)
    pxt = send_transaction(signed_txn)
    self.id = pxt["application-index"]
    print('Application ID '+str(self.id))
    return self
  def update(self):
    sender = self.account['sender']
    params = algod_client.suggested_params()
    params.fee = 1000
    params.flat_fee = True
    txn = transaction.ApplicationUpdateTxn(
      sender.address, params, self.id,
      self.param["approval_program"], 
      self.param["clear_program"]
    )
    signed_txn = txn.sign(sender.private)
    pxt = send_transaction(signed_txn)
    print('Updated existing application ID '+str(self.id))
    return self
  def delete(self):
    sender = self.account['sender']
    params = algod_client.suggested_params()
    params.fee = 1000
    params.flat_fee = True
    txn = transaction.ApplicationDeleteTxn(
      sender.address, params, self.id
    )
    signed_txn = txn.sign(sender.private)
    pxt = send_transaction(signed_txn)
    print('Deleted application ID '+str(pxt["txn"]["txn"]["apid"]))
  def close_out(self):
    sender = self.account['sender']
    params = algod_client.suggested_params()
    params.fee = 1000
    params.flat_fee = True
    txn = transaction.ApplicationCloseOutTxn(
      sender.address, params, self.id
    )
    signed_txn = txn.sign(sender.private)
    pxt = send_transaction(signed_txn)
    print('CloseOut application ID '+str(pxt["txn"]["txn"]["apid"]))
  def clear(self):
    sender = self.account['sender']
    params = algod_client.suggested_params()
    params.fee = 1000
    params.flat_fee = True
    txn = transaction.ApplicationClearStateTxn(
      sender.address, params, self.id
    )
    signed_txn = txn.sign(sender.private)
    pxt = send_transaction(signed_txn)
    print('Cleared application ID '+str(pxt["txn"]["txn"]["apid"]))
  def opt_in(self):
    sender = self.account['sender']
    params = algod_client.suggested_params()
    params.fee = 1000
    params.flat_fee = True
    txn = transaction.ApplicationOptInTxn(
      sender.address, params, self.id
    )
    signed_txn = txn.sign(sender.private)
    pxt = send_transaction(signed_txn)
    print('Opted in application ID '+str(pxt['txn']['txn']['apid']))
    return self
  def call(self, app_args, note):
    sender = self.account['sender']
    params = algod_client.suggested_params()
    params.fee = 1000
    params.flat_fee = True
    txn = transaction.ApplicationNoOpTxn(
      sender.address, params, self.id, app_args, note=note
    )
    signed_txn = txn.sign(sender.private)
    pxt = send_transaction(signed_txn, wait_for_next_round=True)
    print('Called app-id application ID '+str(pxt['txn']['txn']['apid']))
    if "global-state-delta" in pxt:
        print("Global State updated :\n", pxt['global-state-delta'])
    if "local-state-delta" in pxt:
        print("Local State updated :\n", pxt['local-state-delta'])
    return self
  def get_local_state(self, key):
    if (self.local_state is None): return None
    key64 = base64.b64encode(key.encode("utf-8")).decode("utf-8")
    for kv in self.local_state:
      if kv["key"]==key64:
        return kv["value"]
    return None
  def get_local_state_int(self, key):
    state = self.get_local_state(key)
    if state is None: return None
    return state["uint"]
  def get_local_state_bytes(self, key):
    state = self.get_local_state(key)
    if state is None: return None
    return base64.b64decode(state["bytes"])
  def get_local_state_bytes_raw(self, key):
    state = self.get_local_state(key)
    if state is None: return None
    return state["bytes"]
  def read_local_state(self):
    sender_address = self.param['sender']
    local_states = algod_client.account_info(sender_address)['apps-local-state']
    for local_state in local_states :
      if local_state["id"] == int(self.id) :
          self.local_state = local_state["key-value"]
    return self
  def set_app(self, app):
    self.set(
      local_schema = app["local_schema"],
      global_schema = app["global_schema"],
      approval_program = compile_program(app["approval_program"]),
      clear_program = compile_program(app["clear_program"])
    )
    return self
def compile_program(source_code) :
  compile_response = algod_client.compile(source_code)
  return base64.b64decode(compile_response['result'])

def compile_program_file(source_code_path) :
  fileAddr = open(source_code_path+".teal", "r+")
  source_code = fileAddr.read()
  fileAddr.close()

  return compile_program(source_code)


