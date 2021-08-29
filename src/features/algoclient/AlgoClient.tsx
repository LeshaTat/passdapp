import { useState } from 'react';

import { useAppSelector, useAppDispatch } from '../../app/hooks';
import {
  setPurestake,
  selectHost,
  selectToken,
  selectAlgod,
  selectPurestake,
  selectHostIndexer,
  setTokenHostIndexer
} from './algoClientSlice';
import { Button, Form } from 'react-bootstrap';

const purestakeHost = "https://testnet-algorand.api.purestake.io/ps2"
const purestakeHostIndexer = "https://testnet-algorand.api.purestake.io/idx2"

export function AlgorandClient() {
  const host = useAppSelector(selectHost)
  const hostIndexer = useAppSelector(selectHostIndexer)
  const token = useAppSelector(selectToken)
  const algod = useAppSelector(selectAlgod)
  const purestake = useAppSelector(selectPurestake)
  const dispatch = useAppDispatch()
  const [hostCurrent, setHostCurrent] = useState(host)
  const [hostIndexerCurrent, setHostIndexerCurrent] = useState(hostIndexer)
  const [tokenCurrent, setTokenCurrent] = useState(token)

  return <Form>
    <Form.Group controlId="formPurestake">
      <Form.Check 
        type="checkbox" 
        checked={purestake} 
        label="Purestake"        
      >
        <Form.Check.Input type="checkbox" checked={purestake} onChange={(e: any)=>dispatch(setPurestake(e.currentTarget.checked))}/>
        <Form.Check.Label><a target="_blank" href="https://developer.purestake.io/login">Purestake</a></Form.Check.Label>
      </Form.Check>
    </Form.Group>

    <Form.Group controlId="formToken">
      <Form.Label>Token</Form.Label>
      <Form.Control 
        type="text" 
        placeholder="Enter token" 
        value={tokenCurrent} 
        onChange={(e)=>setTokenCurrent(e.currentTarget.value)}
      />
    </Form.Group>

    <Form.Group controlId="formHost">
      <Form.Label>Algod</Form.Label>
      <Form.Control 
        type="text"
        placeholder="Enter server host" 
        disabled={purestake}
        value={
          purestake ? purestakeHost : hostCurrent
        } 
        onChange={(e)=>setHostCurrent(e.currentTarget.value)}
      />
    </Form.Group>
    <Form.Group controlId="formHostIndexer">
      <Form.Label>Indexer</Form.Label>
      <Form.Control 
        type="text"
        placeholder="Enter server host" 
        disabled={purestake}
        value={
          purestake ? purestakeHostIndexer : hostIndexerCurrent
        } 
        onChange={(e)=>setHostIndexerCurrent(e.currentTarget.value)}
      />
    </Form.Group>

    <Button variant="primary" type="submit" onClick={(e) => {
      e.preventDefault()
      dispatch(setTokenHostIndexer({
        token: tokenCurrent, 
        host: purestake ? purestakeHost : hostCurrent,
        hostIndexer: purestake ? purestakeHostIndexer : hostIndexerCurrent
      }));
    }}>
      Save
    </Button>{' '}
    <Button variant="primary" type="submit" onClick={async (e) => {
      e.preventDefault()
      let status = await algod.status().do()
      alert(JSON.stringify(status))
    }}>
      Test
    </Button>
  </Form>
}
