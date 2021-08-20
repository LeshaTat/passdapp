import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { AppThunk, RootState } from '../../app/store'
import { Sigs } from '../../lib/passkit'
import {appId} from "../../dapp.json"
import { selectAccount } from "../account/accountSlice"
import { selectAlgod } from "../algoclient/algoClientSlice"
import { selectDAppState } from "../status/statusSlice"
import { clear, optIn, setup } from "../../lib/passreq"

export const iteratesCount = 1000;

export interface Contract {
  appId: null | number;
  sigs: null | Sigs;
}

const initialState: Contract = {
  appId,
  sigs: null
}

export const contractSlice = createSlice({
  name: 'contract',
  initialState,
  reducers: {
    setSigs: (state, action: PayloadAction<Sigs | null>) => {
      state.sigs = action.payload
    }
  },
})

export const { setSigs } = contractSlice.actions

export const selectSigs = (state: RootState) => state.contract.sigs

export const requestOptIn = (): AppThunk => async (
  dispatch,
  getState
) => {
  const account = selectAccount(getState())
  const algod = selectAlgod(getState())
  if( !account ) throw "Account is not loaded"
  await optIn(algod, account, appId)
};

export const requestClear = (): AppThunk => async (
  dispatch,
  getState
) => {
  const account = selectAccount(getState())
  const algod = selectAlgod(getState())
  if( !account ) throw "Account is not loaded"
  await clear(algod, account, appId)
};

export const requestSetupContract = (passwd: string): AppThunk => async (
  dispatch,
  getState
) => {
  const account = selectAccount(getState())
  const algod = selectAlgod(getState())
  const dappState = selectDAppState(getState())
  if( !account ) throw "Account is not loaded"
  if( !dappState ) throw "App state is not loaded"
  if( dappState.status=="not-created" ) throw "App is not created"
  if( dappState.status=="not-opted-in" ) throw "App is not opted in"
  await setup(
    algod, 
    account, 
    appId, 
    passwd
  )
};

export default contractSlice.reducer;
