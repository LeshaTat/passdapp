# Password-Based Authentication for Algorand using OTPs: Proof Of Concept 

### Primitives
* H - hash function (e.g. sha256).
* PassDApp - stateful smart contract.
* prepareLSig, confirmLSig, confirmTxnLSig, cancelTxn - logic signatures.

### PassDApp Smart Contract

Local states (i.e. user-specific states):
* counter - number that is used to specify the current OTP
* secret - hash of the current OTP
* mark - identifier of transaction group that is currently being confirmed

We use the principle of OTPs generation and verification borrowed from Lamport's paper [[Password Authentication with Insecure Communication](http://lamport.azurewebsites.net/pubs/password.pdf)]. It means that every OTP in a serie lies in a hash preimage of previous OTP (i.e. H(OTP_previous) = OTP_next).


Types of call app transaction:

* ["setup", new_secret, new_counter]

  sets counter and secret states;

* ["prepare", OTP, new_mark]

  approves if mark=="" and H^d(OTP)==secret, where d==counter modulo 3; 
  
  sets mark=new_mark, secret=OTP, counter=counter-d;

* ["confirm", OTP]

  approves if mark==\<id of current transaction\> and H^2(OTP)==secret; 
  
  sets mark="", secret=OTP, counter=counter-2;
* ["cancel", OTP]
  
  approves if H(OTP)==secret; 
  
  sets mark="", secret=OTP, counter=counter-1.

PyTeal specification for contract and logic signatures can be found in file /pysrc/passdapp.py.

### Setup

1. Generate 44-bits password randomly. User gets it as an 4-words passphrase where each word is chosen randomly from the [list](https://git.io/fhZUO) of 2048 words.

2. Opt-in to PassDApp smart contract.

3. Call PassDApp with arguments 

        ["setup", H^1000(password), 1000].

## Protocol

Let *tx* be a transaction. To send it to the ledger user should proceed through next steps.

1. Prepare group transaction (*tx*, *confirm*). 
    Transaction *confirm* is a PassDApp call with arguments

        ["confirm", H^(k-2)(password)], 

    where k is a number dividable by three nearest to the current value of local state "counter". Note that on this step nothing is sent to the ledger.

2. Send to the ledger another PassDApp call with arguments

        ["prepare", H^k(password), mark],
    
    where k is the same as above and mark is the identifier of *confirm* transaction. Note that transaction *confirm* belongs to group (*tx*, *confirm*) and its identifier also identifies this whole group including *tx* transaction.

    The transaction is signed by prepareLSig that checks that the app id is right and the first argument is indeed the keyword "prepare" (of course, one should also check fee amount etc).

3. Check if the identifier of *confirm* is correctly stored in local state "mark" of PassDApp smart contract. If it is not then send cancel transaction (see below) and return to step 1, else proceed further.

    Send to the ledger the group (*tx*, *confirm*) where both transactions are signed by logic signatures *confirmLSig* and *confirmTxnLSig* respectively. 

    *confirmLSig* checks that there is a suitable confirmation transaction (i.e. app call with right app id and the keyword "confirm" in the first position of arguments list) in the group and that it's sender is the same as for *tx* transaction. 
    
    *confirmTxnLSig* checks that current transaction is a suitable confirmation transaction (in the same way as explained above). 

Cancel transaction is a call to PassDApp transaction with arguments
   
    ["cancel", H^(k-1)(password)].

It is signed by cancelLSig that checks the that an app id of transaction is correct and that the first argument is keyword "cancel".

## Build and run

### Pre-Requests

This project uses *python 3.9* and *node*. Make sure you have them installed.

In order to run this project you need access to working algorand node.
Web-app currently supports two options: sandbox or purestake. 
Python scripts can be configured to connect to any algorand node.

### Installation

Setup python and node dependencies.

`pip install -r requirements.txt`

`npm install`

Make configuration file with credentials for algorand node and alogrand account (freshly generated at first run).
   
`python config_purestake.py <TOKEN>` 

OR

`python config_sandbox.py` 

Configuration will be written in *config.yml*. Feel free to change its content if you want to use some other credentials.

Run a test script.

`python test.py`

Compile and run web-app.

`npm start`


***WARNING! This solution is intended for learning purposes only. It does not cover error checking and other edge cases. The smart contract(s) in this solution have NOT been audited. Therefore, it should not be used as a production application.***
