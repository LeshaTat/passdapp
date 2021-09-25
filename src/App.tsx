import React from 'react'
import styles from './App.module.css'
import { AlgorandClient } from './features/algoclient/AlgoClient'
import { Account } from './features/account/Account'
import { Status } from './features/status/Status'
import { Contract } from './features/contract/Contract'
import { Auth } from './features/auth/Auth'
import { Col, Container, Row, Tab, Tabs } from 'react-bootstrap'
import classNames from "classnames"

function TabBase(props: {children: React.ReactNode}) {
  return <div className={
    classNames(
      styles.tabBase, 
      "border-bottom", "border-left", "border-right"
    )}>
    {props.children}
  </div>
}

function App() {
  return <div className={styles.main}>
    <Container>
      <Row>
        <Col><h3>Algorand PassDApp</h3></Col>
      </Row>
      <Row>
        <Col sm={3}>
          <Status/>
        </Col>
        <Col sm={9}>
          <Tabs defaultActiveKey="algoclient">
            <Tab eventKey="algoclient" title="Node Provider">
              <TabBase>
                <AlgorandClient/>
              </TabBase>
            </Tab>
            <Tab eventKey="account" title="Setup">
              <TabBase>
                <Account/>
              </TabBase>
              <TabBase>
                <Contract/>
              </TabBase>
            </Tab>
            <Tab eventKey="auth" title="Transaction Authentication">
              <TabBase>
                <Auth/>
              </TabBase>
            </Tab>
          </Tabs>
        </Col>
      </Row>
    </Container>
  </div>
}

export default App;
