
import * as https from 'https'
import * as url from 'url'
import * as fs from 'fs'
import * as path from 'path'

// Script took from https://github.com/decentraland/marketplace/blob/master/indexer/scripts/buildData.ts

enum Network {
    MATIC = 'matic',
    MUMBAI = 'mumbai'
}

enum ContractName {
    marketplace = 'marketplace',
    tickets = 'tickets'
}

const startBlockByNetwork: Record<Network, Record<string, number>> = {
    [Network.MATIC]: {
      marketplace: 25657775,
      tickets: 	25657919,
    },
    [Network.MUMBAI]: {
      marketplace: 25405958,
      tickets: 25405972,
    }
}

const contractAddressByNetwork: Record<Network, Record<string, string>> = {
    [Network.MATIC]: {
      marketplace: "0xbC2E88848Add239a7d41F917216063B36d19975b",
      tickets: 	"0x57374a7f837A782403468839C80F0F7700A762e7",
    },
    [Network.MUMBAI]: {
      marketplace: "0x2b5224d135073f273F4787c360f5BF766f3f9362",
      tickets: "0x7Ebef62D0B8696A49Fd73667D67beD48148d83D4",
    }
}

async function build() {
    let network: Network = process.env.ETHEREUM_NETWORK as Network
    
    if (!network) {
        for (let i = 0; i < process.argv.length; i++) {
            if (process.argv[i] === '--network') {
                network = process.argv[i + 1] as Network
                break
            }
        }
    }

    if (!network || !Object.values(Network).includes(network)) {
        throw new Error(
          "Supply a valid network using --network."
        )
    }

    const basePath = path.resolve(__dirname, '../')
  
    const ethereum = new Ethereum(network)
  
    const template = new TemplateFile(ethereum)
  
    await Promise.all([
        template.write(`${basePath}/.subgraph.yaml`, `${basePath}/subgraph.yaml`)
      ])
}


class Ethereum {
    network: Network
  
    contractAddresses: Record<string, string>
    startBlocks: Record<string, number>
  
    constructor(network: Network) {
      this.network = network
      this.startBlocks = startBlockByNetwork[network]
      this.contractAddresses = contractAddressByNetwork[network]
    }

    getAddress(contractName: string) {
      return (
        this.contractAddresses[contractName]
      )
    }
  
    getStartBlock(contractName: string) {
      return (
        this.startBlocks[contractName]
      )
    }
  
    private getDefaultAddress() {
      return '0x0000000000000000000000000000000000000000'
    }
  
    private getDefaultStartBlock() {
      return 0
    }
}

class TemplateFile {
    constructor(public ethereum: Ethereum) {}
  
    async write(src: string, destination: string) {
      const contents = await readFile(src)
  
      try {
        const newContents = new Parser(contents, this.ethereum).parse()
  
        await writeFile(destination, newContents)
      } catch (error) {
        await deleteFile(destination)
        throw error
      }
    }
  }
  
  class Parser {
    constructor(public text: string, public ethereum: Ethereum) {}
  
    parse() {
      let newText = this.replaceNetworks(this.text)
      newText = this.replaceAddresses(newText)
      newText = this.replaceStartBlocks(newText)
      return newText
    }
  
    replaceAddresses(text = this.text) {
      for (const placeholder of this.getPlaceholders('address')) {
        const contractName = this.getPlaceholderValue(placeholder)
        const address = this.ethereum.getAddress(contractName)
        text = text.replace(placeholder, address)
      }
      return text
    }
  
    replaceStartBlocks(text = this.text) {
      for (const placeholder of this.getPlaceholders('startBlock')) {
        const contractName = this.getPlaceholderValue(placeholder)
        const startBlock = this.ethereum.getStartBlock(contractName)
        text = text.replace(placeholder, startBlock.toString())
      }
      return text
    }
  
    replaceNetworks(text = this.text) {
      return text.replace(/{{network}}/g, this.ethereum.network)
    }
  
    getPlaceholders(name: string, text = this.text) {
      const regexp = new RegExp(`{{${name}\:[a-zA-Z0-9]+}}`, 'g')
      return text.match(regexp) || []
    }
  
    getPlaceholderValue(placeholder: string) {
      // Example: {{operator:value}}
      const [_, value] = placeholder.replace(/{|}/g, '').split(':')
      return value
    }
}

async function readFile(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(path, 'utf-8', (err, data) =>
        err ? reject(err) : resolve(data)
      )
    })
  }
  
  async function deleteFile(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(path)) {
        resolve()
      }
      fs.unlink(path, err => (err ? reject(err) : resolve()))
    })
  }
  
  async function writeFile(path: string, data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(path, data, 'utf-8', err => (err ? reject(err) : resolve()))
    })
  }


build().then(() => console.log('All done'))