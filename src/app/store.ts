import { configureStore, ThunkAction, Action } from '@reduxjs/toolkit'
import algorandClientReducer from '../features/algoclient/algoClientSlice'
import accountReducer from '../features/account/accountSlice'
import statusReducer from '../features/status/statusSlice'
import contractReducer from '../features/contract/contractSlice'
import authReducer from '../features/auth/authSlice'

export const store = configureStore({
  reducer: {
    status: statusReducer,
    account: accountReducer,
    contract: contractReducer,
    algorandClient: algorandClientReducer,
    auth: authReducer
  },
})

export type AppDispatch = typeof store.dispatch
export type RootState = ReturnType<typeof store.getState>
export type AppThunk<ReturnType = Promise<void>> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>