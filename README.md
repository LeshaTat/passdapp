# Password Authentication for Algorand: Proof Of Concept 

Algorand users have to use 25 words long mnemonic phrases to confirm their identity. For some applications, this level of security is overwhelming. It would be much more convenient if one could use relatively short passwords. This projects demonstrates a working approach of how to solve this problem. The schema is simple but non-trivial. It is based on a two-step protocol and uses both types of smart contracts (stateful and stateless).

## Pre-Requests

This project uses *python 3.9* and *node*. Make sure you have them installed.

In order to run this project you need access to working algorand node.
Web-app currently supports two options: sandbox or purestake. 
Python scripts can be configured to connect to any algorand node.

## Installation

Setup python and node dependencies.

`pip install -r requirements.txt`

`npm install`

Make configuration file with credentials for algorand node and alogrand account (freshly generated at first run).
   
`python config_purestake.py <TOKEN>` 

OR

`python config_sandbox.py` 

Configuration will be written in *config.yml*. Feel free to change its content if you want to use some other credentials.

Compile and run web-app.

`npm start`


***WARNING! This solution is intended for learning purposes only. It does not cover error checking and other edge cases. The smart contract(s) in this solution have NOT been audited. Therefore, it should not be used as a production application.***
