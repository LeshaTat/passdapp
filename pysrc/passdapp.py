import json
import os
import base64
from pathlib import Path
from algosdk.future import transaction
from pyteal import Mod, Arg, Add, Minus, TealType, If, Gt, Ge, Seq, Assert, Txn, App, Bytes, Int, Btoi, Return, And, Or, OnComplete, Cond, compileTeal, Mode, Global, Gtxn, Sha256, ScratchVar
from .config import algod_client
from nacl.utils import random

def approval_program():
    register = Seq([
        App.localPut(Int(0), Bytes("counter"), Int(0)),
        App.localPut(Int(0), Bytes("secret"), Bytes("")),
        App.localPut(Int(0), Bytes("mark"), Bytes("")),
        Return(Int(1))
    ])

    setup = Seq([
        Assert(Txn.application_args.length() == Int(3)),
        App.localPut(Int(0), Bytes("secret"), Txn.application_args[1]),
        App.localPut(Int(0), Bytes("counter"), Btoi(Txn.application_args[2])),
        App.localPut(Int(0), Bytes("mark"), Bytes("")),
        Return(Int(1))
    ])

    hash_secret = ScratchVar(TealType.bytes)
    prepare = Seq([
        Assert(Txn.application_args.length() == Int(3)),
        
        # Check if app is in wait_prepare state
        Assert(Bytes("")==App.localGet(Int(0), Bytes("mark"))),
        
        # After a secret is acquired counter must be equal to 3*k
        hash_secret.store(Sha256(Txn.application_args[1])),
        App.localPut(Int(0), Bytes("counter"), App.localGet(Int(0), Bytes("counter"))-Int(1)),
        If(
            Mod(App.localGet(Int(0), Bytes("counter")), Int(3)) != Int(0),
            Seq([
                hash_secret.store(Sha256(hash_secret.load())),
                App.localPut(Int(0), Bytes("counter"), App.localGet(Int(0), Bytes("counter"))-Int(1)),
            ])
        ),
        If(
            Mod(App.localGet(Int(0), Bytes("counter")), Int(3)) != Int(0),
            Seq([
                hash_secret.store(Sha256(hash_secret.load())),
                App.localPut(Int(0), Bytes("counter"), App.localGet(Int(0), Bytes("counter"))-Int(1)),
            ])
        ),

        # Assert hash^d(new secret) = secret, where d = old_counter-counter
        Assert(hash_secret.load()==App.localGet(Int(0), Bytes("secret"))),
        App.localPut(Int(0), Bytes("secret"), Txn.application_args[1]),
        App.localPut(Int(0), Bytes("mark"), Txn.application_args[2]),
        Return(Int(1))
    ])

    confirm = Seq([
        Assert(Txn.application_args.length() == Int(2)),
        Assert(Sha256(Sha256(Txn.application_args[1]))==App.localGet(Int(0), Bytes("secret"))),
        Assert(Txn.tx_id()==App.localGet(Int(0), Bytes("mark"))),
        App.localPut(Int(0), Bytes("counter"), App.localGet(Int(0), Bytes("counter"))-Int(2)),
        App.localPut(Int(0), Bytes("secret"), Txn.application_args[1]),
        App.localPut(Int(0), Bytes("mark"), Bytes("")),
        Return(Int(1))
    ])

    cancel = Seq([
        Assert(Txn.application_args.length() == Int(2)),
        Assert(Sha256(Txn.application_args[1])==App.localGet(Int(0), Bytes("secret"))),
        App.localPut(Int(0), Bytes("counter"), App.localGet(Int(0), Bytes("counter"))-Int(1)),
        App.localPut(Int(0), Bytes("secret"), Txn.application_args[1]),
        App.localPut(Int(0), Bytes("mark"), Bytes("")),
        Return(Int(1))
    ])

    program = Cond(
        [Txn.application_id() == Int(0), Return(Int(1))],
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(Txn.sender() == Global.creator_address())],
        [Txn.on_completion() == OnComplete.UpdateApplication, Return(Int(0))],
        [Txn.on_completion() == OnComplete.CloseOut, Return(Int(1))],
        [Txn.on_completion() == OnComplete.OptIn, register],
        [Txn.application_args[0] == Bytes("prepare"), prepare],
        [Txn.application_args[0] == Bytes("setup"), setup],
        [Txn.application_args[0] == Bytes("confirm"), confirm],
        [Txn.application_args[0] == Bytes("cancel"), cancel]
    )

    return {
        "program": program,
        "local_schema": transaction.StateSchema(1, 2),
        "global_schema": transaction.StateSchema(0, 0)
    }

def clear_program():
    return Int(1)

def prepare_lsig_program(appId):        
    return And(
        Txn.fee() <= Int(1000),
        Txn.application_id() == Int(appId),
        Txn.on_completion() == OnComplete.NoOp,
        Txn.application_args[0] == Bytes("prepare")
    )
def confirm_lsig_program(appId):
    return And(
        Txn.fee() <= Int(1000),
        Txn.application_id() == Int(appId),
        Txn.on_completion() == OnComplete.NoOp,
        Txn.application_args[0] == Bytes("confirm")
    )
def cancel_lsig_program(appId):
    return And(
        Txn.fee() <= Int(1000),
        Txn.application_id() == Int(appId),
        Txn.on_completion() == OnComplete.NoOp,
        Txn.application_args[0] == Bytes("cancel")
    )
def confirm_txn_lsig_program(appId):
    return Seq([
        Assert(Txn.rekey_to() == Global.zero_address()),
        Assert(Txn.fee() <= Int(1000)),
        Assert(Gtxn[Btoi(Arg(0))].sender() == Txn.sender()),
        Assert(Gtxn[Btoi(Arg(0))].application_id() == Int(appId)),
        Assert(Gtxn[Btoi(Arg(0))].on_completion() == OnComplete.NoOp),
        Return(Gtxn[Btoi(Arg(0))].application_args[0] == Bytes("confirm"))
    ])

def save_teal(name, program):
    with open(name+'.teal', 'w') as f:
        f.write(program)

def get_app():
    d = approval_program()
    approvalTeal = compileTeal(d["program"], mode=Mode.Application, version=3)
    clearTeal = compileTeal(clear_program(), mode=Mode.Application, version=3)
    return {
        "local_schema": d["local_schema"],
        "global_schema": d["global_schema"],
        "approval_program": approvalTeal,
        "clear_program": clearTeal
    }

path = Path(os.path.dirname(__file__))
dir = path.parent

def save_app(app_id, app):
    prepare_lsig_teal = compileTeal(prepare_lsig_program(app_id), mode=Mode.Signature, version=3)
    confirm_lsig_teal = compileTeal(confirm_lsig_program(app_id), mode=Mode.Signature, version=3)
    confirm_txn_lsig_teal = compileTeal(confirm_txn_lsig_program(app_id), mode=Mode.Signature, version=3)
    cancel_lsig_teal = compileTeal(cancel_lsig_program(app_id), mode=Mode.Signature, version=3)
    prepare_lsig_compiled = algod_client.compile(prepare_lsig_teal)
    confirm_lsig_compiled = algod_client.compile(confirm_lsig_teal)
    confirm_txn_lsig_compiled = algod_client.compile(confirm_txn_lsig_teal)
    cancel_lsig_compiled = algod_client.compile(cancel_lsig_teal)
    pbkdf2_salt = base64.b64encode(random(32)).decode('UTF8')
    save_teal(os.path.join(dir, "teal/approval"), app["approval_program"])
    save_teal(os.path.join(dir, "teal/clear"), app["clear_program"])
    save_teal(os.path.join(dir, "teal/prepare"), prepare_lsig_teal)
    save_teal(os.path.join(dir, "teal/confirm"), confirm_lsig_teal)
    save_teal(os.path.join(dir, "teal/confirmTxn"), confirm_txn_lsig_teal)
    save_teal(os.path.join(dir, "teal/cancel"), cancel_lsig_teal)    
    with open(os.path.join(dir, "src/dapp.json"), 'w') as f:
        f.write(json.dumps({
            "appId": app_id,
            "prepare": prepare_lsig_compiled["result"],
            "confirm": confirm_lsig_compiled["result"],
            "confirmTxn": confirm_txn_lsig_compiled["result"],
            "cancel": cancel_lsig_compiled["result"],
            "pbkdf2Salt": pbkdf2_salt
        }, indent=4))

def load_app():
    d = None
    with open(os.path.join(dir, "src/dapp.json"), 'r') as f:
        d = json.loads(f.read())
    return d