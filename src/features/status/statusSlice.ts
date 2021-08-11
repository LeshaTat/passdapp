import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { AppThunk, RootState } from '../../app/store'
import { loadState, PassDAppState } from "../../lib/passkit"
import { selectAddress } from "../account/accountSlice"
import { selectAlgod } from "../algoclient/algoClientSlice"
import { appId } from "../../dapp.json"

export interface Status {
  amount: string;
  dappState: null | PassDAppState;
  processing: boolean;
}

const initialState: Status = {
  amount: "",
  dappState: null,
  processing: false
}

export const statusSlice = createSlice({
  name: 'status',
  initialState,
  reducers: {
    setFullDAppState: (state, action: PayloadAction<{amount: number, dappState: PassDAppState}>) => {
      let {amount, dappState} = action.payload
      state.amount = amount.toString()
      state.dappState = dappState
    },
    setUnavailableStatus: (state, action: PayloadAction<void>) => {
      state.amount = ""
      state.dappState = null
    },
    setAmount: (state, action: PayloadAction<number>) => {
      state.amount = action.payload.toString()
    },
    setProcessing: (state, action: PayloadAction<boolean>) => {
      state.processing = action.payload
    },
    setAmountUnknown: (state, action: PayloadAction<undefined>) => {
      state.amount = ""
    }
  },
})

export const { setAmount, setAmountUnknown, setFullDAppState, setUnavailableStatus, setProcessing } = statusSlice.actions

export const selectAmount = (state: RootState) => state.status.amount
export const selectProcessing = (state: RootState) => state.status.processing
export const selectDAppState = (state: RootState) => state.status.dappState

export const requestStatus = (): AppThunk => async (
  dispatch,
  getState
) => {
  const address = selectAddress(getState())
  const algod = selectAlgod(getState())
  if (address) {
    let data = await algod.accountInformation(address).do()
    dispatch(setFullDAppState({amount: data.amount, dappState: loadState(data, address, appId)}))
    dispatch(setAmount(data.amount))
  }
};

export const makeRequest = <T = void>(rq: AppThunk<Promise<T>>, opts?: {noStatus?: boolean}): AppThunk<Promise<T>> => async (
  dispatch,
  getState
) => {
  dispatch(setProcessing(true))
  try {
    let res = await dispatch(rq)
    if( !opts || !opts.noStatus ) {
      await dispatch(requestStatus())
    }
    return res
  } catch(e) {
    throw e
  } finally {
    dispatch(setProcessing(false))
  }
}

export const makeStatusRequest = (): AppThunk<Promise<void>> => async (
  dispatch,
  getState
) => {
  dispatch(setProcessing(true))
  try {
    await dispatch(requestStatus())
  } catch(e) {
    throw e
  } finally {
    dispatch(setProcessing(false))
  }
}

export default statusSlice.reducer;
