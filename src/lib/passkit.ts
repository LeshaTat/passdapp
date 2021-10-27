import algosdk from "algosdk";
import dapp from "../dapp.json"
import { decode, encode, makeHashIterate } from "./utils";

type PassDAppSetupState = {
  status: "wait-setup"
}

type PassDAppPrepareState = {
  status: "wait-prepare",
  secret: string,
  counter: number
}

type PassDAppConfirmState = {
  status: "wait-confirm",
  mark: string,  
  counter: number,
  secret: string
}

export type PassDAppState = {status: "not-created"} | {status: "not-opted-in"} | 
PassDAppSetupState | PassDAppPrepareState | PassDAppConfirmState

export type AuthRequest = string


export function checkAuthRequest(mark: string, state: PassDAppConfirmState) {
  return mark==state.mark
}

export function checkPasswd(appId: number, passwd: Uint8Array, state: PassDAppState): boolean {
  if( 
    state.status==="not-created" || 
    state.status==="not-opted-in" ||
    state.status==="wait-setup"
  ) return false
  return encode(makeHashIterate(
    passwd, state.counter
  ))==state.secret
}

type StateValue = {
  bytes: string,
  uint: number
}

export function loadState(data: Record<string, any>, address: string, appId: number): PassDAppState {
  if( !data ) return {status: "not-created"}
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
  if( !dict.secret.bytes ) {
    return {
      status: "wait-setup"
    }
  } else if( dict.mark.bytes ) {
    return {
      status: "wait-confirm", 
      mark: dict.mark.bytes, 
      secret: dict.secret.bytes,
      counter: dict.counter.uint
    }
  } else {
    return {
      status: "wait-prepare", 
      counter: dict.counter.uint,
      secret: dict.secret.bytes
    }
  }
//  "bm9wZQ=="
  return {status: "not-opted-in"}
}

export function getCounter(dappState: PassDAppState): number {
  if( !dappState ) return 0
  if( 
    dappState.status=="not-created" || 
    dappState.status=="not-opted-in" ||
    dappState.status=="wait-setup"
  ) {
    return 0
  }
  return dappState.counter
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

// At least 1,000,000, better is 5,000,000 - do not use the values you can find on the internet which are way too low
const pbkdf2IterationsCount = 1000000

export async function hashPasswd(passwd: string): Promise<Uint8Array> {
  console.log("Applying a password hashing function (PBKDF2)... ")
    
  let hashed = new Uint8Array(await window.crypto.subtle.deriveBits(
    {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: decode(dapp["pbkdf2Salt"] || 'hpzMoniyx4nX2+nBwTCF+FFJW1OVanyMxO0bRj/a5Uw='),
        iterations: pbkdf2IterationsCount,
    },
    await window.crypto.subtle.importKey(
      "raw",
      Uint8Array.from(passwd, (c: string) => c.charCodeAt(0)), 
      "PBKDF2", 
      false,
      ["deriveBits"]
    ),
    256
  ))

  console.log("Done")

  return hashed
}
