import { createSelector } from "reselect"

import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { AppThunk, RootState } from '../../app/store'
import {  
  checkAuthRequest,
  checkPasswd
} from '../../lib/passkit'
import algosdk from "algosdk"
import { selectAddress, setAddress } from "../account/accountSlice"
import { selectAlgod, selectIndexer } from "../algoclient/algoClientSlice"
import { selectSigs, setSigs } from "../contract/contractSlice"
import { makeRequest, selectDAppState } from "../status/statusSlice"
import { appId } from "../../dapp.json"
import { hashPasswd } from "../../lib/passkit"
import { cancel, confirmCTxn, findCredentials, makeConfirmTxn, prepare } from "../../lib/passreq"
import { encode, makeHashIterate } from "../../lib/utils"

export type RequestType = "find" | "prepare" | "confirm" | "cancel"

export interface Auth { 
  passwdRaw: string,
  passwdHashed: Uint8Array | null,
  currentRequest: RequestType | null;
}

const initialState: Auth = {
  passwdRaw: "",
  passwdHashed: null,
  currentRequest: null
}

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setPasswd: (state, action: PayloadAction<string>) => {
      if( state.passwdRaw != action.payload ) {
        state.passwdHashed = null
      }
      state.passwdRaw = action.payload
    },
    setCurrentRequest: (state, action: PayloadAction<RequestType | null>) => {
      state.currentRequest = action.payload
    },
  },
})

export const { setPasswd, setCurrentRequest } = authSlice.actions

export const selectCurrentRequest = (state: RootState) => state.auth.currentRequest
export const selectPasswdRaw = (state: RootState) => state.auth.passwdRaw

let memorizedPasswdRaw: string = ""
let memorizedPasswdHash: Uint8Array | null = null
export const selectPasswd = async (state: RootState) => {
  if( !memorizedPasswdHash || state.auth.passwdRaw != memorizedPasswdRaw ) {
    memorizedPasswdHash = await hashPasswd(state.auth.passwdRaw)
    memorizedPasswdRaw = state.auth.passwdRaw
  }
  return memorizedPasswdHash
}

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
  async (dappState, passwd): Promise<boolean> => {
    if( !dappState ) return false
    return checkPasswd(appId, await passwd, dappState)
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
  const passwd = await selectPasswd(getState())
  if( !sigs ) throw "Credentials were not set"
  if( !dappState || dappState.status!="wait-prepare" ) throw "Incorrect contract local state"
  dispatch(setCurrentRequest('prepare'))
  try {
    let kPrepare = dappState.counter - dappState.counter%3
    let kConfirm = kPrepare - 2
    let secretConfirm = makeHashIterate(passwd, kConfirm)
    let ctxn = await makeConfirmTxn(
      algod, address, appId, 
      secretConfirm
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
      makeHashIterate(secretConfirm, 2),
      encode(groupCTxn.rawTxID())
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
  if( !sigs ) throw "Signatures not loaded"
  if( !dappState || dappState.status!=="wait-confirm" ) throw "Not waiting for confirmation"
  if( !checkAuthRequest(
    encode(groupCTxn.rawTxID()),
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
  const passwd = await selectPasswd(getState())
  if( !sigs ) throw "Signatures not loaded"
  if( !dappState || dappState.status!=="wait-confirm" ) throw "Not waiting for confirmation"
  dispatch(setCurrentRequest("cancel"))
  try {
    await cancel(
      algod, 
      address, 
      sigs, 
      appId, 
      makeHashIterate(passwd, dappState.counter-1),
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
  const passwd = await selectPasswd(getState())
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
  const passwd = await selectPasswd(getState())
  const dappState = selectDAppState(getState())
  if( !dappState || !sigs || !checkPasswd(appId, passwd, dappState)) {
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
