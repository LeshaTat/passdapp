import algosdk from "algosdk";
import { AuthRequest, makeNote, makeSecret, makeSigs, Sigs } from "./passkit";
import { concatUint8Arrays, decode, encode, makeHash } from "./utils";

/**
 * utility function to wait on a transaction to be confirmed
 * the timeout parameter indicates how many rounds do you wish to check pending transactions for
 */
async function waitForConfirmation(algod: algosdk.Algodv2, txId: string, timeout: number) {
  const status = await algod.status().do();
  if (typeof status === 'undefined')
    throw new Error('Unable to get node status');
  const startround = status['last-round'];
  let currentround = startround;

  while (currentround < startround + timeout) {
    const pendingInfo = await algod
      .pendingTransactionInformation(txId)
      .do();
    if (pendingInfo !== undefined) {
      if (
        pendingInfo['confirmed-round'] !== null &&
        pendingInfo['confirmed-round'] > 0
      ) {
        // Got the completed Transaction
        // Wait for current block to be assimilated
        
        await algod.statusAfterBlock(currentround).do();
        return pendingInfo;
      }

      if (
        pendingInfo['pool-error'] != null &&
        pendingInfo['pool-error'].length > 0
      ) {
        // If there was a pool error, then the transaction has been rejected!
        throw new Error(
          `Transaction Rejected pool error${pendingInfo['pool-error']}`
        );
      }
    }
    console.log('Waiting on round '+currentround)
    await algod.statusAfterBlock(currentround).do();
    currentround += 1;
  }
  /* eslint-enable no-await-in-loop */
  throw new Error(`Transaction not confirmed after ${timeout} rounds!`);
}

export async function optIn(algod: algosdk.Algodv2, account: algosdk.Account, appId: number) {
  const suggestedParams = await algod.getTransactionParams().do();
  let txn = algosdk.makeApplicationOptInTxn(
    account.addr, 
    suggestedParams, 
    appId
  )
  const {txId} = await algod.sendRawTransaction(txn.signTxn(account.sk)).do()
  await waitForConfirmation(algod, txId, 1000)
  console.log('opted in')
}

export async function clear(algod: algosdk.Algodv2, account: algosdk.Account, appId: number) {
  const suggestedParams = await algod.getTransactionParams().do();
  let txn = algosdk.makeApplicationClearStateTxn(
    account.addr, 
    suggestedParams, 
    appId
  )
  const {txId} = await algod.sendRawTransaction(txn.signTxn(account.sk)).do()
  await waitForConfirmation(algod, txId, 1000)
  console.log('cleared')
}

export async function setup(
  algod: algosdk.Algodv2, 
  account: algosdk.Account, 
  appId: number, 
  k: number, 
  passwd: string
) {
  const suggestedParams = await algod.getTransactionParams().do();
  let {
    prepareSig, 
    confirmSig,
    confirmTxnSig,
    cancelSig
  } = makeSigs(account)
  const strToObj = (b: string) => decode(b)
  let txn = algosdk.makeApplicationNoOpTxn(
    account.addr, 
    suggestedParams, 
    appId, [
      decode(btoa("setup")),
      makeHash(makeSecret(appId, passwd, "prepare", k)),
      makeHash(makeSecret(appId, passwd, "confirm", k)),
      makeHash(makeSecret(appId, passwd, "cancel", k))
    ], undefined, undefined, undefined,
    concatUint8Arrays(
      makeNote(appId, passwd), algosdk.encodeObj({
        address: account.addr,
        prepare: strToObj(prepareSig), 
        confirm: strToObj(confirmSig), 
        confirmTxn: strToObj(confirmTxnSig), 
        cancel: strToObj(cancelSig)
      })
    )
  )
  const {txId} = await algod.sendRawTransaction(txn.signTxn(account.sk)).do()
  await waitForConfirmation(algod, txId, 1000)
  
  console.log('setup', passwd)
  return passwd
}

export async function findCredentials(
  indexer: algosdk.Indexer, 
  appId: number, 
  passwd: string
): Promise<{address: string, sigs: Sigs}> {
  let notePrefix = makeNote(appId, passwd)
  let search = await indexer.searchForTransactions()
  .applicationID(appId)
  .txType("appl")
  .notePrefix(notePrefix).do()
  let txs = search && search.transactions
  if( !txs || txs.length==0 ) throw "Password not found"
  let tx = txs[txs.length-1]
  let msg: any = algosdk.decodeObj(decode(tx.note).slice(notePrefix.length))
  return {
    address: msg.address,
    sigs: {
      prepareSig: encode(msg.prepare),
      confirmSig: encode(msg.confirm),
      confirmTxnSig: encode(msg.confirmTxn),
      cancelSig: encode(msg.cancel)
    }
  }
}

export async function prepare(
  algod: algosdk.Algodv2, 
  addr: string,
  sigs: Sigs,
  appId: number,
  secret: string,
  request: AuthRequest
) {
  const suggestedParams = await algod.getTransactionParams().do();
  let txn = algosdk.makeApplicationNoOpTxn(
    addr, 
    suggestedParams, 
    appId, [
      decode(btoa("prepare")),
      decode(btoa(secret)),
      decode(request.nsecret1),
      decode(request.nsecret2),
      decode(request.nsecret3),
      decode(request.nmark)
    ]
  )
  const {txId} = await algod.sendRawTransaction(
    algosdk.signLogicSigTransactionObject(
      txn, 
      algosdk.logicSigFromByte(decode(sigs.prepareSig))
    ).blob
  ).do()
  await waitForConfirmation(algod, txId, 1000)
  return
}

export async function makeConfirmTxn(
  algod: algosdk.Algodv2, 
  addr: string,
  appId: number,
  secret: string,
) {
  const suggestedParams = await algod.getTransactionParams().do();
  return algosdk.makeApplicationNoOpTxn(
    addr, 
    suggestedParams, 
    appId, [
      decode(btoa("confirm")),
      decode(btoa(secret))
    ]
  )
}

export async function cancel(
  algod: algosdk.Algodv2, 
  addr: string,
  sigs: Sigs,
  appId: number,
  secret: string
) {
  const suggestedParams = await algod.getTransactionParams().do();
  let txn = algosdk.makeApplicationNoOpTxn(
    addr, 
    suggestedParams, 
    appId, [
      decode(btoa("cancel")),
      decode(btoa(secret))
    ]
  )
  const {txId} = await algod.sendRawTransaction(
    algosdk.signLogicSigTransactionObject(
      txn, 
      algosdk.logicSigFromByte(decode(sigs.cancelSig))
    ).blob
  ).do()
  await waitForConfirmation(algod, txId, 1000)
}

export async function confirmCTxn(
  algod: algosdk.Algodv2, 
  sigs: Sigs,
  ctxn: algosdk.Transaction,
  txn: algosdk.Transaction
) {
  console.log('ctxn: ', ctxn.txID())
  let lCTxn = algosdk.signLogicSigTransactionObject(
    ctxn, 
    algosdk.logicSigFromByte(decode(sigs.confirmSig))
  ).blob
  console.log('txn: ', txn.txID())
  let lsigTxn = algosdk.logicSigFromByte(decode(sigs.confirmTxnSig))
  // There is no method to change arg for LogicSig object.
  // Do it manually.
  lsigTxn.args = [algosdk.encodeUint64(0)]
  let lTxn = algosdk.signLogicSigTransactionObject(
    txn, 
    lsigTxn
  ).blob
  const {txId} = await algod.sendRawTransaction(
    [lCTxn, lTxn]
  ).do()
  await waitForConfirmation(algod, txId, 1000)
  return
}

