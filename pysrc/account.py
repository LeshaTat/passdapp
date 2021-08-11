from algosdk import account, mnemonic

def generateMnemonic():
    [private, address] = account.generate_account()
    return mnemonic.from_private_key(private)

class Account:
    def __init__(self, addr=None):
        self.address = addr
        self.private = None
    def generate(self):
        [self.private, self.address] = account.generate_account()
        return self
    def fromMnemonic(self, mnem):
        self.address = mnemonic.to_public_key(mnem)
        self.private = mnemonic.to_private_key(mnem)
        return self
    def fromDict(self, d):
        self.fromMnemonic(d["mnemonic"])
        return self
    def toDict(self):
        return {"mnemonic": mnemonic.from_private_key(self.private)}
