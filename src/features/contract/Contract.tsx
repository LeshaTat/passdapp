import { useState } from 'react'

import { useAppSelector, useAppDispatch } from '../../app/hooks'
import {
  selectSigs,
  requestSetupContract, requestOptIn, requestClear
} from './contractSlice'
import {
  selectAddress,
} from '../account/accountSlice'
import styles from './Contract.module.css'
import { Button, Form } from 'react-bootstrap'

import { selectAlgod } from '../algoclient/algoClientSlice'
import { selectAccount } from '../account/accountSlice'

import { genPasswd } from '../../lib/passkit'
import { makeRequest, selectDAppState } from '../status/statusSlice'

import FuncPanel from '../../components/funcPanel'

export function SetupButton(props: {onSetup: (passwd: string)=>void}) {
  const [passwd, setPasswd] = useState<string>("")
  return <div className={styles.setupButton}>
    <Button disabled={!passwd} onClick={()=>{
      props.onSetup(passwd)
    }}>
      Setup
    </Button>
    <span className={styles.generatePasswd}>
      <Form.Control 
      value={passwd} 
      onChange={(e)=>setPasswd(e.target.value)} 
      type="text" placeholder="Enter password"/>
      <Button onClick={()=>setPasswd(genPasswd())}>
        Generate
      </Button>
    </span>
  </div>
}

function handleError(e: any) {
  if( typeof e == "string" ) {
    alert(e)
  } else {
    alert(e?.response?.body?.message || "Failed")
  }
}

export function Contract() {
  const sigs = useAppSelector(selectSigs)
  const dispatch = useAppDispatch()
  const algod = useAppSelector(selectAlgod)
  const account = useAppSelector(selectAccount)
  const address = useAppSelector(selectAddress)
  const dappState = useAppSelector(selectDAppState)

  return <Form>    
    <FuncPanel>
      <Button
      disabled={!account || !algod} 
      onClick={
        async () => {
          try {
            await dispatch(makeRequest(requestOptIn()))
          } catch(e) {
            handleError(e)
          }
        }
      }>
        Opt in
      </Button>
    </FuncPanel>
    <FuncPanel>
      <SetupButton onSetup={
        async (passwd) => {
          try {
            await dispatch(makeRequest(requestSetupContract(passwd)))
          } catch(e) {
            handleError(e)
          }
        }
      }/>
    </FuncPanel>
    <FuncPanel>
      <Button
      disabled={!account || !algod} 
      onClick={
        async () => {
          try {
            await dispatch(makeRequest(requestClear()))
          } catch(e) {
            handleError(e)
          }
        }
      }>
        Clear
      </Button>
    </FuncPanel>
  </Form>
}
