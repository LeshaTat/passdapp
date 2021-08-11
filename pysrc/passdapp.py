import json
import os
from pathlib import Path
from algosdk.future import transaction
from pyteal import Arg, Add, Minus, TealType, If, Gt, Ge, Seq, Assert, Txn, App, Bytes, Int, Btoi, Return, And, Or, OnComplete, Cond, compileTeal, Mode, Global, Gtxn, Sha256, ScratchVar
from .config import algod_client

def approval_program():
    is_admin = Txn.sender() == Global.creator_address()

    register = Seq([
        App.localPut(Int(0), Bytes("counter"), Int(0)),
        App.localPut(Int(0), Bytes("secret1"), Bytes("")),
        App.localPut(Int(0), Bytes("secret2"), Bytes("")),
        App.localPut(Int(0), Bytes("secret3"), Bytes("")),
        App.localPut(Int(0), Bytes("mark"), Bytes("")),
        App.localPut(Int(0), Bytes("nsecret1"), Bytes("")),
        App.localPut(Int(0), Bytes("nsecret2"), Bytes("")),
        App.localPut(Int(0), Bytes("nsecret3"), Bytes("")),
        App.localPut(Int(0), Bytes("nmark"), Bytes("")),
        Return(Int(1))
    ])

    setup = Seq([
        Assert(Txn.application_args.length() == Int(4)),
        App.localPut(Int(0), Bytes("secret1"), Txn.application_args[1]),
        App.localPut(Int(0), Bytes("secret2"), Txn.application_args[2]),
        App.localPut(Int(0), Bytes("secret3"), Txn.application_args[3]),
        App.localPut(Int(0), Bytes("counter"), App.localGet(Int(0), Bytes("counter"))+Int(1)),
        Return(is_admin)
    ])

#    testSecret = Return(Sha256(Txn.application_args[1])==App.localGet(Int(0), Bytes("secret1")))
#        testSecret = Return(Txn.application_args[1]==App.localGet(Int(0), Bytes("secret1")))

    prepare = Seq([
        Assert(Txn.application_args.length() == Int(6)),
        Assert(Sha256(Txn.application_args[1])==App.localGet(Int(0), Bytes("secret1"))),
        App.localPut(Int(0), Bytes("secret1"), Bytes("")),
        App.localPut(Int(0), Bytes("nsecret1"), Txn.application_args[2]),
        App.localPut(Int(0), Bytes("nsecret2"), Txn.application_args[3]),
        App.localPut(Int(0), Bytes("nsecret3"), Txn.application_args[4]),
        App.localPut(Int(0), Bytes("nmark"), Txn.application_args[5]),
        App.localPut(Int(0), Bytes("counter"), App.localGet(Int(0), Bytes("counter"))+Int(1)),
        Return(Int(1))
    ])

#    confirm = Return(Int(1))
    confirm = Seq([
        Assert(Txn.application_args.length() == Int(2)),
        Assert(Bytes("")==App.localGet(Int(0), Bytes("secret1"))),
        Assert(Sha256(Txn.application_args[1])==App.localGet(Int(0), Bytes("secret2"))),
        App.localPut(Int(0), Bytes('secret1'), App.localGet(Int(0), Bytes("nsecret1"))),
        App.localPut(Int(0), Bytes('secret2'), App.localGet(Int(0), Bytes("nsecret2"))),
        App.localPut(Int(0), Bytes('secret3'), App.localGet(Int(0), Bytes("nsecret3"))),
        App.localPut(Int(0), Bytes('mark'), App.localGet(Int(0), Bytes("nmark"))),
        If(
            Gt(Global.group_size(), Int(1)),
            Return(Txn.tx_id()==App.localGet(Int(0), Bytes("nmark"))),
            Return(Int(1))
        ),
    ])

    cancel = Seq([
        Assert(Txn.application_args.length() == Int(2)),
        Assert(Bytes("")==App.localGet(Int(0), Bytes("secret1"))),
        Assert(Sha256(Txn.application_args[1])==App.localGet(Int(0), Bytes("secret3"))),
        App.localPut(Int(0), Bytes('secret1'), App.localGet(Int(0), Bytes("nsecret1"))),
        App.localPut(Int(0), Bytes('secret2'), App.localGet(Int(0), Bytes("nsecret2"))),
        App.localPut(Int(0), Bytes('secret3'), App.localGet(Int(0), Bytes("nsecret3"))),
        App.localPut(Int(0), Bytes('mark'), Bytes("")),
        Return(Int(1))
    ])

    program = Cond(
        [Txn.application_id() == Int(0), Return(Int(1))],
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(is_admin)],
        [Txn.on_completion() == OnComplete.UpdateApplication, Return(is_admin)],
        [Txn.on_completion() == OnComplete.CloseOut, Return(Int(1))],
        [Txn.on_completion() == OnComplete.OptIn, register],
        [Txn.application_args[0] == Bytes("prepare"), prepare],
        [Txn.application_args[0] == Bytes("setup"), setup],
        [Txn.application_args[0] == Bytes("confirm"), confirm],
        [Txn.application_args[0] == Bytes("cancel"), cancel]
    )

    return {
        "program": program,
        "local_schema": transaction.StateSchema(1, 8),
        "global_schema": transaction.StateSchema(0, 0)
    }

def clear_program():
    return Int(1)

def prepare_lsig_program(appId):        
    return And(
        Txn.application_id() == Int(appId),
        Txn.on_completion() == OnComplete.NoOp,
        Txn.application_args[0] == Bytes("prepare")
    )
def confirm_lsig_program(appId):
    return And(
        Txn.application_id() == Int(appId),
        Txn.on_completion() == OnComplete.NoOp,
        Txn.application_args[0] == Bytes("confirm")
    )
def cancel_lsig_program(appId):
    return And(
        Txn.application_id() == Int(appId),
        Txn.on_completion() == OnComplete.NoOp,
        Txn.application_args[0] == Bytes("cancel")
    )
def confirm_txn_lsig_program(appId):
    return Seq([
        Assert(Txn.rekey_to() == Global.zero_address()),
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
        }, indent=4))

def load_app():
    d = None
    with open(os.path.join(dir, "src/dapp.json"), 'r') as f:
        d = json.loads(f.read())
    return d