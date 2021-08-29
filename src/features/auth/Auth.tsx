import { useCallback, useState } from 'react'

import { useAppSelector, useAppDispatch } from '../../app/hooks'
import {
  AvailableRequests,
  makePaymentTxn,
  requestAuth,
  requestCancel,
  requestConfirm,
  requestLSigs,
  requestPrepare,
  RequestType,
  selectAvailableRequests,
  selectCurrentRequest,
  selectPasswd,
  setPasswd
} from './authSlice'
import {
  selectAddress,
} from '../account/accountSlice'
import { Button, Form, Card, Container, Row, Col } from 'react-bootstrap'

import { makeRequest } from '../status/statusSlice'

import FuncPanel from "../../components/funcPanel"

import algosdk from 'algosdk'
import { encode } from '../../lib/utils'

function handleError(e: any) {
  if( typeof e == "string" ) {
    alert(e)
  } else {
    alert(e?.response?.body?.message || "Request failed")
  }
}

function ButtonRequest(props: {
  title: string, 
  type: RequestType,
  availableRequests: AvailableRequests,
  currentRequest: RequestType | null,
  onClick: ()=>void
}) {
  let {title, type, availableRequests, currentRequest, onClick} = props
  return <Button 
  disabled={!availableRequests[type] || !!currentRequest} 
  onClick={onClick}
  variant={type==currentRequest ? "outline-primary" : "primary"}>
    { title }
  </Button>
}

export function Auth() {
  const dispatch = useAppDispatch()
  const address = useAppSelector(selectAddress)
  const availableRequests = useAppSelector(selectAvailableRequests)
  const currentRequest = useAppSelector(selectCurrentRequest)
  const passwd = useAppSelector(selectPasswd)

  const [curPasswd, setCurPasswd] = useState<string>(passwd)

  const [raddr, setRAddr] = useState<string>("QC7XT7QU7X6IHNRJZBR67RBMKCAPH67PCSX4LYH4QKVSQ7DQZ32PG5HSVQ")
  const [amount, setAmount] = useState<number>(110000)
  const [txn, setTxn] = useState<null | algosdk.Transaction>(null)
  const [groupTxn, setGroupTxn] = useState<null | algosdk.Transaction>(null)
  const [groupCTxn, setGroupCTxn] = useState<null | algosdk.Transaction>(null)
  if( !groupTxn || !groupCTxn ) {
    delete availableRequests.confirm
  }

  const handleFind = useCallback(
    async () => {
      if( !curPasswd ) return
      if( curPasswd!=passwd ) dispatch(setPasswd(curPasswd))
      try {
        await dispatch(makeRequest(requestLSigs()))
      } catch(e) {
        handleError(e)
      }
    },
    [txn, curPasswd]
  )

  const handlePrepare = useCallback(
    async () => {
      if( !raddr ) return
      try {
        if( curPasswd!=passwd ) dispatch(setPasswd(curPasswd))
        const curTxn = await dispatch(makePaymentTxn(raddr, amount))
        setTxn(curTxn)
        setGroupCTxn(null)
        setGroupTxn(null)
        let {groupCTxn, groupTxn} = await dispatch(makeRequest(
          requestPrepare(curTxn)
        ))
        setGroupCTxn(groupCTxn)
        setGroupTxn(groupTxn)
      } catch(e) {
        handleError(e)
      }
    },
    [curPasswd, address, raddr, amount]
  )

  const handleConfirm = useCallback(
    async () => {
      if( curPasswd!=passwd ) dispatch(setPasswd(curPasswd))
      if( !groupCTxn || !groupTxn ) return
      try {
        await dispatch(makeRequest(requestConfirm(groupCTxn, groupTxn)))
      } catch(e) {
        handleError(e)
      }
    },
    [groupCTxn, groupTxn, curPasswd]
  )

  const handleCancel = useCallback(
    async () => {
      if( curPasswd!=passwd ) dispatch(setPasswd(curPasswd))
      if( !curPasswd ) return
      try {
        await dispatch(makeRequest(requestCancel()))
      } catch(e) {
        handleError(e)
      }
    },
    [passwd]
  )

  const handleMake = useCallback(
    async () => {
      try {
        if( !curPasswd ) throw "Passwd is not set"
        if( curPasswd!=passwd ) dispatch(setPasswd(curPasswd))
        await dispatch(requestAuth(
          async () => {
            const curTxn = await dispatch(makePaymentTxn(raddr, amount))
            setTxn(curTxn)
            setGroupCTxn(null)
            setGroupTxn(null)
            return curTxn
          },
          (groupCTxn, groupTxn) => {
            setGroupCTxn(groupCTxn)
            setGroupTxn(groupTxn)
          }
        ))
      } catch(e) {
        handleError(e)
      }
    },
    [txn, curPasswd, amount, raddr]
  )
  return <Container>
    <Row>
      <Col>
        <Form.Control 
        value={curPasswd} 
        onChange={(e)=>setCurPasswd(e.target.value)} 
        type="text" placeholder="Enter password"/>
      </Col>
    </Row>
    <Row>
      <Col>
        <FuncPanel>
          <Card>
            <Card.Header>
              <Button onClick={handleMake}>
                Make Payment Transaction
              </Button>
            </Card.Header>
            <Card.Body>
              <Form>
                <Form.Group controlId="formBasicAddress">
                  <Form.Label>Recepient address</Form.Label>
                  <Form.Control 
                  type="text" 
                  placeholder="XYZ..." 
                  value={raddr}
                  onChange={e=>setRAddr(e.target.value)}
                  />
                </Form.Group>
                <Form.Group controlId="formBasicAmount">
                  <Form.Label>Amount</Form.Label>
                  <Form.Control 
                  type="number" 
                  placeholder="Amount" 
                  value={amount?.toString()||0}
                  onChange={e=>setAmount(parseInt(e.target.value)||0)}
                  />
                </Form.Group>
              </Form>
            </Card.Body>
          </Card>
        </FuncPanel>
      </Col>
      <Col xs="auto" style={{display: "flex"}}>
        <div style={{display: "flex", justifyContent: "center", flex: 1, flexDirection: "column"}}>
          <FuncPanel>
            1. <ButtonRequest 
              type="find"
              title="Find credentials"
              onClick={handleFind} 
              {...{availableRequests, currentRequest}}
            />
          </FuncPanel>
          <FuncPanel>
            2. <ButtonRequest 
              type="prepare"
              title="Prepare"
              onClick={handlePrepare} 
              {...{availableRequests, currentRequest}}
            />
          </FuncPanel>
          <FuncPanel>
            3. <ButtonRequest 
              type="confirm"
              title="Confirm"
              onClick={handleConfirm} 
              {...{availableRequests, currentRequest}}
            />
          </FuncPanel>
          <FuncPanel>
            3<span style={{position: 'absolute'}}>*</span>. <ButtonRequest 
              type="cancel"
              title="Cancel"
              onClick={handleCancel} 
              {...{availableRequests, currentRequest}}
            />
          </FuncPanel>
        </div>
      </Col>
    </Row>
    <Row>
      <Col>
        <Card>
          <Card.Header>
            Transaction Content
          </Card.Header>
          <Card.Body>
            <div>
              {txn?.txID()}
            </div>
            <div>
              {
                groupCTxn 
                ? "Raw TxID in group: "+encode(groupCTxn.rawTxID())
                : ""
              }
            </div>
            <pre>
              {JSON.stringify(JSON.parse(txn?.toString()||"{}"), null, 2)}
            </pre>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  </Container>
}
