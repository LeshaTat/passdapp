import { createSelector } from "reselect"

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../app/store';
import algosdk from "algosdk";

export interface AlgoClient {
  purestake: boolean;
  token: string;
  host: string;
  hostIndexer: string;
}

const initialState: AlgoClient = {
  purestake: true,
  token: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  host: 'http://localhost:4001',
  hostIndexer: 'http://localhost:8980'
};

export const algoClientSlice = createSlice({
  name: 'algorandClient',
  initialState,
  reducers: {
    setTokenHostIndexer: (state, action: PayloadAction<{token: string, host: string, hostIndexer: string}>) => {
      state.token = action.payload.token
      state.host = action.payload.host
      state.hostIndexer = action.payload.hostIndexer
    },
    setPurestake: (state, action: PayloadAction<boolean>) => {
      state.purestake = action.payload
    }
  },
});

export const { setTokenHostIndexer, setPurestake } = algoClientSlice.actions

export const selectHost = (state: RootState) => state.algorandClient.host
export const selectHostIndexer = (state: RootState) => state.algorandClient.hostIndexer
export const selectToken = (state: RootState) => state.algorandClient.token
export const selectPurestake = (state: RootState) => state.algorandClient.purestake
export const selectAlgod = createSelector(
  selectHost,
  selectToken,
  selectPurestake,
  (host, token, purestake) => {
    let url = new URL(host)
    let server = url.protocol+"//"+url.hostname+url.pathname    

    return new algosdk.Algodv2(
      purestake ? {
        "X-API-Key": token
      } : token, 
      server, parseInt(url.port)||""
    )
  }
)
export const selectIndexer = createSelector(  
  selectHostIndexer,
  selectToken,
  selectPurestake,
  (hostIndexer, token, purestake) => {
    let url = new URL(hostIndexer)
    let server = url.protocol+"//"+url.hostname+url.pathname    

    return new algosdk.Indexer(
      purestake ? {
        "X-API-Key": token
      } : token, 
      server, parseInt(url.port)||""
    )
  }
)

export default algoClientSlice.reducer;
