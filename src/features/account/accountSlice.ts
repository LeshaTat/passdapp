import { createSelector } from "reselect"

import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { AppThunk, RootState } from '../../app/store'
import algosdk from "algosdk"
import { setSigs } from "../contract/contractSlice"
import { makeStatusRequest, setAmountUnknown } from "../status/statusSlice"

export interface AccountClient {
  mnemonic: string;
  address: string;
}

const initialState: AccountClient = {
  mnemonic: "",
  address: ""
}

export const accountSlice = createSlice({
  name: 'account',
  initialState,
  reducers: {
    setAddress: (state, action: PayloadAction<string>) => {
      if( state.address!=action.payload ) {
        state.mnemonic = ''
      }
      state.address = action.payload      
    },
    setMnemonic: (state, action: PayloadAction<string>) => {
      state.mnemonic = action.payload
      state.address = algosdk.mnemonicToSecretKey(state.mnemonic).addr
    },
  },
})

export const { setMnemonic, setAddress } = accountSlice.actions

export const selectMnemonic = (state: RootState) => state.account.mnemonic
export const selectAddress = (state: RootState) => state.account.address
export const selectAccount = createSelector(
  selectMnemonic,
  (mnemonic) => mnemonic ? algosdk.mnemonicToSecretKey(mnemonic) : null
)

export const setAddressMnemonicAndUpdateContract = (payload: {
  address?: string,
  mnemonic?: string
}): AppThunk => async (dispatch, getState) => {
  let oldAddress = selectAddress(getState())
  if( payload.mnemonic ) {
    dispatch(setMnemonic(payload.mnemonic))
  } else if( payload.address ) {
    dispatch(setAddress(payload.address))
  }
  let newAddress = selectAddress(getState())
  if( newAddress==oldAddress ) return
  dispatch(setSigs(null))
  dispatch(setAmountUnknown())
}

export const setMnemonicUpdateAccount = (
  payload: {mnemonic: string}
): AppThunk => async (dispatch, getState) => {
  let { mnemonic } = payload
  dispatch(setAddressMnemonicAndUpdateContract({mnemonic}))
  dispatch(makeStatusRequest())
}


export default accountSlice.reducer;
