import algosdk from "algosdk";
import dapp from "../dapp.json"
import { decode, encode, makeHash, makeHashBase64 } from "./utils";

type PassDAppSetupState = {
  status: "wait-setup",
  counter: number
}

type PassDAppPrepareState = {
  status: "wait-prepare",
  secret: string,
  counter: number
}

type PassDAppConfirmState = {
  status: "wait-confirm",
  nmark: string,  
  counter: number,
  secret: string,
  nsecret1: string,
  nsecret2: string,
  nsecret3: string
}

export type PassDAppState = {status: "not-created"} | {status: "not-opted-in"} | 
PassDAppSetupState | PassDAppPrepareState | PassDAppConfirmState

export type AuthRequest = {
  nmark: string,
  nsecret1: string,
  nsecret2: string,
  nsecret3: string
}

export function makeAuthRequest(appId: number, nmark: string, passwd: string, k: number) {
  return {
    nmark,
    nsecret1: makeHashBase64(makeSecret(appId, passwd, "prepare", k)),
    nsecret2: makeHashBase64(makeSecret(appId, passwd, "confirm", k)),
    nsecret3: makeHashBase64(makeSecret(appId, passwd, "cancel", k))
  }
}

export function checkAuthRequest(auth: AuthRequest, state: PassDAppConfirmState) {
  let {nmark, nsecret1, nsecret2, nsecret3} = state
  return (nmark==auth.nmark || !auth.nmark) 
  && nsecret1==auth.nsecret1 
  && nsecret2==auth.nsecret2
  && nsecret3==auth.nsecret3
}

export function checkPasswd(appId: number, passwd: string, state: PassDAppState): boolean {
  if( 
    state.status==="not-created" || 
    state.status==="not-opted-in" ||
    state.status==="wait-setup"
  ) return false
  if( state.status==="wait-prepare" ) {
    return makeHashBase64(
      makeSecret(appId, passwd, "prepare", state.counter-1)
    )==state.secret
  } else {
    return makeHashBase64(
      makeSecret(appId, passwd, "confirm", state.counter-2)
    )==state.secret
  }
}

type StateValue = {
  bytes: string,
  uint: number
}

export function loadState(data: Record<string, any>, address: string, appId: number): PassDAppState {
  if( !data ) return {status: "not-created"}
  if( !data["created-apps"] || !data["created-apps"].some((el: any)=>el.id==appId)) {
    return {status: "not-created"}
  }
  let apps = data["apps-local-state"]
  if( !apps ) {
    return {status: "not-opted-in"}
  }
  let app = apps.find((el: any)=>el.id==appId)
  if( !app ) {
    return {status: "not-opted-in"}
  }
  console.log(app)
  let kvs = app['key-value']
  let dict: Record<string, StateValue> = {}
  for( let i in kvs) {
    let kv = kvs[i] 
    console.log(kv, atob(kv.key))
    dict[atob(kv.key)] = kv.value
  }
  console.log(dict)
  if( !dict.secret1.bytes && !dict.secret2.bytes && !dict.secret3.bytes ) {
    return {
      status: "wait-setup",
      counter: dict.counter.uint
    }
  } else if( !dict.secret1.bytes ) {
    return {
      status: "wait-confirm", 
      nmark: dict.nmark.bytes, 
      counter: dict.counter.uint,
      secret: dict.secret2.bytes,
      nsecret1: dict.nsecret1.bytes,
      nsecret2: dict.nsecret2.bytes,
      nsecret3: dict.nsecret3.bytes,
    }
  } else {
    return {
      status: "wait-prepare", 
      counter: dict.counter.uint,
      secret: dict.secret1.bytes
    }
  }
//  "bm9wZQ=="
  return {status: "not-opted-in"}
}

export function getCounter(dappState: PassDAppState): number {
  if( !dappState ) return 0
  if( dappState.status=="not-created" || dappState.status=="not-opted-in" ) return 0
  return dappState.counter
}

export function makeNote(appId: number, passwd: string) {
  return makeHash(passwd+"#"+appId+"#note")
}

export function makeSecret(appId: number, passwd: string, type: "confirm"|"prepare"|"cancel", k: number) {
  return makeHashBase64(passwd+'#'+appId+'#'+k+'#'+type)
}

export function genPasswd() {
  let passwd = algosdk.secretKeyToMnemonic(algosdk.generateAccount().sk)
  passwd = passwd.split(" ").slice(0, 4).join(" ")
  return passwd
}

export type LogicSig = ReturnType<typeof algosdk.makeLogicSig>

export type Sigs = {
  prepareSig: string;
  confirmSig: string;
  confirmTxnSig: string;
  cancelSig: string;
}

export function makeSigs(account: algosdk.Account): Sigs {
  let prepareSig = algosdk.makeLogicSig(decode(dapp.prepare))
  let confirmSig = algosdk.makeLogicSig(decode(dapp.confirm))
  let confirmTxnSig = algosdk.makeLogicSig(decode(dapp.confirmTxn))
  let cancelSig = algosdk.makeLogicSig(decode(dapp.cancel))

  // LogicSig#sig(secret, msig) is broken: msig==undefined is not allowed by type system
  prepareSig.sig = prepareSig.signProgram(account.sk)
  confirmSig.sig = confirmSig.signProgram(account.sk)
  confirmTxnSig.sig = confirmTxnSig.signProgram(account.sk)
  cancelSig.sig = cancelSig.signProgram(account.sk)
  return {
    prepareSig: encode(prepareSig.toByte()),
    confirmSig: encode(confirmSig.toByte()),
    confirmTxnSig: encode(confirmTxnSig.toByte()),
    cancelSig: encode(cancelSig.toByte())
  }
}