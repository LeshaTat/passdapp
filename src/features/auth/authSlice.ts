import { createSelector } from "reselect"

import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { AppThunk, RootState } from '../../app/store'
import {  
  makeAuthRequest, 
  makeSecret,
  checkAuthRequest,
  checkPasswd
} from '../../lib/passkit'
import algosdk from "algosdk"
import { selectAddress, setAddress } from "../account/accountSlice"
import { selectAlgod, selectIndexer } from "../algoclient/algoClientSlice"
import { selectSigs, setSigs } from "../contract/contractSlice"
import { makeRequest, selectDAppState } from "../status/statusSlice"
import { appId } from "../../dapp.json"
import { cancel, confirmCTxn, findCredentials, makeConfirmTxn, prepare } from "../../lib/passreq"
import { encode } from "../../lib/utils"

export type RequestType = "find" | "prepare" | "confirm" | "cancel"

export interface Auth { 
  passwd: string,
  currentRequest: RequestType | null;
}

const initialState: Auth = {
  passwd: "tilt assert mushroom useless",
  currentRequest: null
}

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setPasswd: (state, action: PayloadAction<string>) => {
      state.passwd = action.payload
    },
    setCurrentRequest: (state, action: PayloadAction<RequestType | null>) => {
      state.currentRequest = action.payload
    },
  },
})

export const { setPasswd, setCurrentRequest } = authSlice.actions

export const selectCurrentRequest = (state: RootState) => state.auth.currentRequest
export const selectPasswd = (state: RootState) => state.auth.passwd

export type AvailableRequests = {[K in RequestType]?: boolean}

export const selectAvailableRequests = createSelector(
  selectDAppState,
  selectSigs,
  (dappState, sigs): AvailableRequests => {
    if( !sigs || !dappState ) return {find: true}
    if( dappState.status==="not-created" ) return {}
    if( dappState.status==="not-opted-in" ) return {find: true}
    if( dappState.status==="wait-setup" ) return {find: true}
    if( dappState.status==="wait-prepare" ) return {find: true, prepare: true}
    if( dappState.status==="wait-confirm" ) return {find: true, confirm: true, cancel: true}
    return {find: true, prepare: true, confirm: true, cancel: true}
  }
)

export const selectPasswdCheck = createSelector(
  selectDAppState,
  selectPasswd,
  (dappState, passwd): boolean => {
    if( !dappState ) return false
    return checkPasswd(appId, passwd, dappState)
  }
)


export const makePaymentTxn = (raddr: string, amount: number): 
AppThunk<Promise<algosdk.Transaction>> => async (
  dispatch,
  getState
) => {
  const address = selectAddress(getState())
  const algod = selectAlgod(getState())
  if( !amount ) throw "Payment amount is not set"
  if( !raddr ) throw "Receiver address is not set"
  const suggestedParams = await algod.getTransactionParams().do()
  const curTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: address,
    to: raddr,
    amount,
    suggestedParams
  })
  return curTxn
}

export const requestPrepare = (txn: algosdk.Transaction): 
AppThunk<Promise<{groupCTxn: algosdk.Transaction, groupTxn: algosdk.Transaction}>> => async (
  dispatch,
  getState
) => {
  const address = selectAddress(getState())
  const algod = selectAlgod(getState())
  const sigs = selectSigs(getState())
  const dappState = selectDAppState(getState())
  const passwd = selectPasswd(getState())
  if( !sigs ) throw "Credentials were not set"
  if( !dappState || dappState.status!="wait-prepare" ) throw "Incorrect contract local state"
  dispatch(setCurrentRequest('prepare'))
  try {
    let ctxn = await makeConfirmTxn(
      algod, address, appId, 
      makeSecret(appId, passwd, "confirm", dappState.counter-1)
    )
    let [groupCTxn, groupTxn] = algosdk.assignGroupID([
      ctxn,
      // Do not mutate initial txn object
      algosdk.decodeUnsignedTransaction(
        algosdk.encodeUnsignedTransaction(txn)
      )
    ])

    await prepare(
      algod, 
      address, 
      sigs, 
      appId, 
      makeSecret(appId, passwd, "prepare", dappState.counter-1),
      makeAuthRequest(appId, encode(groupCTxn.rawTxID()), passwd, dappState.counter)
    )
    return {groupCTxn, groupTxn}
  } finally {
    dispatch(setCurrentRequest(null))
  }
};

export const requestConfirm = (
  groupCTxn: algosdk.Transaction, 
  groupTxn: algosdk.Transaction
): AppThunk => async (
  dispatch,
  getState
) => {
  const algod = selectAlgod(getState())
  const sigs = selectSigs(getState())
  const dappState = selectDAppState(getState())
  const passwd = selectPasswd(getState())
  if( !sigs ) throw "Signatures not loaded"
  if( !dappState || dappState.status!=="wait-confirm" ) throw "Not waiting for confirmation"
  if( !checkAuthRequest(
    makeAuthRequest(appId, encode(groupCTxn.rawTxID()), passwd, dappState.counter-1),
    dappState
  ) ) throw "State check failed: it is not safe to proceed"

  dispatch(setCurrentRequest("confirm"))
  try {
    await confirmCTxn(
          algod, 
          sigs,
          groupCTxn,
          groupTxn
    )
  } finally {
    dispatch(setCurrentRequest(null))
  }
};

export const requestCancel = (): AppThunk => async (
  dispatch,
  getState
) => {
  const address = selectAddress(getState())
  const algod = selectAlgod(getState())
  const sigs = selectSigs(getState())
  const dappState = selectDAppState(getState())
  const passwd = selectPasswd(getState())
  if( !sigs ) throw "Signatures not loaded"
  if( !dappState || dappState.status!=="wait-confirm" ) throw "Not waiting for confirmation"
  if( !checkAuthRequest(
    makeAuthRequest(appId, "", passwd, dappState.counter-1),
    dappState
  ) ) throw "State check failed: it is not safe to proceed"
  dispatch(setCurrentRequest("cancel"))
  try {
    await cancel(
      algod, 
      address, 
      sigs, 
      appId, 
      makeSecret(appId, passwd, "cancel", dappState.counter-2),
    )
  } finally {
    dispatch(setCurrentRequest(null))
  }
};

export const requestLSigs = (): AppThunk => async (
  dispatch,
  getState
) => {
  const indexer: algosdk.Indexer = selectIndexer(getState())
  const passwd = selectPasswd(getState())
  dispatch(setCurrentRequest("find"))
  try {
    const {address, sigs} =  await findCredentials(
      indexer, 
      appId,
      passwd
    )
    dispatch(setAddress(address))
    dispatch(setSigs(sigs))
  } finally {
    dispatch(setCurrentRequest(null))
  }
};

export const requestAuth = (
  genTxn: (address: string) => Promise<algosdk.Transaction>,
  onGroup?: (groupCTxn: algosdk.Transaction, groupTxn: algosdk.Transaction) => void
): AppThunk => async (
  dispatch,
  getState
) => {
  const sigs = selectSigs(getState())
  if( !sigs || !selectPasswdCheck(getState()) ) {
    await dispatch(makeRequest(requestLSigs()))
  }
  const address = selectAddress(getState())
  let {groupCTxn, groupTxn} = await dispatch(makeRequest(
    requestPrepare(await genTxn(address))
  ))
  onGroup?.(groupCTxn, groupTxn)

  await dispatch(makeRequest(requestConfirm(groupCTxn, groupTxn)))
}

export default authSlice.reducer;
