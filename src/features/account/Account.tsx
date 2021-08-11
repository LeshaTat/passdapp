import { useState } from 'react';

import { useAppSelector, useAppDispatch } from '../../app/hooks';
import {
  setMnemonic,
  selectMnemonic,
  setMnemonicUpdateAccount
} from './accountSlice';
import { Button, Form } from 'react-bootstrap';
import algosdk from "algosdk"

export function Account() {
  const mnemonic = useAppSelector(selectMnemonic)
  const dispatch = useAppDispatch()
  const [mnemonicCurrent, setMnemonicCurrent] = useState(mnemonic)

  return <div>    
    <Form>
      <Form.Group controlId="mnemonic">
        <Form.Label>Mnemonic</Form.Label>
        <Form.Control 
          type="text" 
          placeholder="Enter 25-words mnemonic phrase" 
          value={mnemonicCurrent} 
          onChange={(e)=>setMnemonicCurrent(e.currentTarget.value)}
        />
      </Form.Group>

      <Button variant="primary" type="submit" onClick={(e) => {
        e.preventDefault()
        let newMnemonic = algosdk.secretKeyToMnemonic(algosdk.generateAccount().sk)
        setMnemonicCurrent(newMnemonic)
        dispatch(setMnemonicUpdateAccount({mnemonic: newMnemonic}))
      }}>
        New
      </Button>{' '}
      <Button variant="primary" type="submit" disabled={mnemonicCurrent==mnemonic || mnemonicCurrent.split(' ').length!=25} onClick={(e) => {
        e.preventDefault()
        dispatch(setMnemonic(mnemonicCurrent))
        dispatch(setMnemonicUpdateAccount({mnemonic: mnemonicCurrent}))
      }}>
        Save
      </Button>{' '}
    </Form>
  </div>
}
