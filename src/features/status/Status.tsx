import { useAppSelector, useAppDispatch } from '../../app/hooks';
import {
  makeStatusRequest,
  selectAmount,
  selectDAppState,
  selectProcessing,
} from './statusSlice';
import {
  selectAddress
} from '../account/accountSlice';
import {
  selectHost
} from '../algoclient/algoClientSlice';
import styles from './Status.module.css';
import { Button, Card, Col, Container, Row } from 'react-bootstrap';

export function Status() {
  const processing = useAppSelector(selectProcessing)
  const amount = useAppSelector(selectAmount)
  const address = useAppSelector(selectAddress)
  const host = useAppSelector(selectHost)
  const dappState = useAppSelector(selectDAppState)
  const dispatch = useAppDispatch()

  return <Card>    
    <Card.Body>
      <div className={styles.hostPlace}>
        {host}
      </div>
      <Container>
        <Row as="dl">
          <Col as="dt">Address: </Col>
          <Col as="dd">{ address || "unknown" }</Col>
          <Col as="dt">Amount: </Col>
          <Col as="dd">{ amount=="" ? "unknown" : amount }</Col>
        </Row>
      </Container>
      <pre className={styles.statePlace}>
        {
          processing
          ? "loading..."
          : dappState ? JSON.stringify(dappState, null, 4) : ""
        }
      </pre>
      <Button variant="primary" type="submit" disabled={!address} 
      onClick={async (e) => {
        e.preventDefault()
        dispatch(makeStatusRequest())
      }}>
        Update
      </Button>
    </Card.Body>
  </Card>
}
