import algosdk from "algosdk"

export function newMnemonic(): string {
  let account = algosdk.generateAccount()
  return algosdk.secretKeyToMnemonic(account.sk);  
}

export function mnemonicToAccount(mn: string): algosdk.Account {
  return algosdk.mnemonicToSecretKey(mn)
}