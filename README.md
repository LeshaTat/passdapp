# Password-Based Authentication for Algorand using OTPs: Proof Of Concept 

## How to use the web-app

1. Open [live demo page](https://leshatat.github.io/passdapp/).

2. Fill out the form of access to an Algorand node on the *Node Provider* tab.

3. Setup password on the *Setup* tab (enter your mnemonic, opt-in, generate a password, and press setup). This step is not necessary on the second and consequent runs.

4. Make a sample payment transaction on the *Transaction Authentication* tab. You can either proceed through protocol step-by-step or run all the actions at once by pressing the big *Sign and Send Payment Transaction* button. Do not forget to put your password in the input form.

## Protocol description

### Primitives
* H - a hash function (e.g. sha256).
* PassDApp - a stateful smart contract.
* prepareLSig, confirmLSig, confirmTxnLSig, cancelTxn - a logic signatures.

### PassDApp Smart Contract

Local states (i.e., user-specific states):
* **counter** - the index of the current OTP in the sequence,
* **secret** - the hash of the current OTP,
* **mark** - the identifier of the transaction group currently being confirmed.

We use OTPs generation and verification principle borrowed from Lamport's paper [[Password Authentication with Insecure Communication](http://lamport.azurewebsites.net/pubs/password.pdf)]. It means that every OTP in a sequence lies in a hash pre-image of the previous OTP (i.e., H(OTP_previous) = OTP_next).


Types of the PassDApp call transactions:

* ["setup", new_secret, new_counter]

  initializes **counter** and **secret** states;

* ["prepare", OTP, new_mark]

  approves if **mark**=="" and H^d(OTP)==**secret**, where d==**counter** modulo 3; 
  
  sets **mark**=new_mark, **secret**=OTP, **counter**=**counter**-d;

* ["confirm", OTP]

  approves if **mark**==\<id of current transaction\> and H^2(OTP)==**secret**; 
  
  sets **mark**="", **secret**=OTP, **counter**=**counter**-2;
* ["cancel", OTP]
  
  approves if H(OTP)==secret; 
  
  sets **mark**="", **secret**=OTP, **counter**=**counter**-1.

You can find PyTeal specifications for contract and logic signatures in the file /pysrc/passdapp.py.

### Setup

1. Generate 44-bits password randomly. The user gets it as an 4-words passphrase where each word is chosen randomly from the [list](https://git.io/fhZUO) of 2048 words.

2. Opt-in to PassDApp smart contract.

3. Call PassDApp with arguments 

        ["setup", H^1000(password), 1000].

### Authentication

Let *tx* be a transaction. To send it to the ledger, the user should proceed through the following steps.

1. Prepare the group transaction (*tx*, *confirm*). 
    The *confirm* transaction is a PassDApp call with arguments

        ["confirm", H^(k-2)(password)], 

    where k is a number dividable by three nearest to the current value of the local state **counter**. Do not send that transaction to the ledger on this step.

2. Send to the ledger another PassDApp call with arguments

        ["prepare", H^k(password), mark],
    
    where k is the same as above and mark is the identifier of the *confirm* transaction. Note that the *confirm* transaction belongs to the group (*tx*, *confirm*), and its identifier also identifies this whole group, including the *tx* transaction.

    Sign this transaction with the *prepareLSig* that checks the app id is correct, and the first argument is indeed the keyword "prepare" (of course, one should also check fee amount, etc.).

3. Check if the *confirm* transaction's identifier is stored in the local state **mark** of the PassDApp smart contract. If it is not, then send cancel transaction (see below) and return to step 1. If the identifier is correct, proceed further.

    Sign transactions in the group (*tx*, *confirm*) with *confirmLSig* and *confirmTxnLSig*, respectively. Send the group to the ledger. 

    *confirmLSig* checks a suitable confirmation transaction (i.e., app call with right app id and the keyword "confirm" in the first position of arguments list) exists in the group, and its sender is the same as for the *tx* transaction. 
    
    *confirmTxnLSig* checks current transaction is a suitable confirmation transaction (in the same way as explained above). 

Cancel transaction is a call to PassDApp transaction with arguments
   
    ["cancel", H^(k-1)(password)].

Sign this call transaction with *cancelLSig* that checks the app id is correct, and the first argument is the "cancel" keyword.

## Build

### Pre-Requests

This project uses *python 3.9* and *node*. Make sure you have them installed.

To run this project, you need access to an Algorand node.
Web-app currently supports two options: sandbox or purestake. 
You can configure python scripts to connect to any Algorand node.

### Installation

Setup python and node dependencies.

`pip install -r requirements.txt`

`npm install`

Make configuration file with credentials for an Algorand node and an Alogrand account (freshly generated at first run).
   
`python config_purestake.py <TOKEN>` 

OR

`python config_sandbox.py` 

Scripts will write configuration to *config.yml*. Feel free to change its content if you want to use some other credentials.

Create the app.

`python create_app.py`

Run a test script.

`python test.py`

Compile and run web-app.

`npm start`

***WARNING! This solution is intended for learning purposes only. It does not cover error checking and other edge cases. The smart contract(s) in this solution have NOT been audited. Therefore, it should not be used as a production application.***
