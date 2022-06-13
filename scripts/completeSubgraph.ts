
import * as fs from 'fs'
import * as path from 'path'

// Script took from https://github.com/decentraland/marketplace/blob/master/indexer/scripts/buildData.ts

enum Network {
    MATIC = 'matic',
    MUMBAI = 'mumbai'
}

const startBlockByNetwork: Record<Network, Record<string, number>> = {
  [Network.MATIC]: {
    default: 26285118,  
    // Can define contract specific also.
  },
  [Network.MUMBAI]: {
    default: 26728706,
    // Can define contract specific also.
  }
}

const contractAddressByNetwork: Record<Network, Record<string, string>> = {
  [Network.MATIC]: {  // TODO: Set prod addresss here
    admin: "0xf4EfD08600Bbe35C187252FBb1eCD2F7a264D162",
    event: "0xfc1F8ccDc5897983e56058548ff591F0F333eE9B",
    ticket: 	"0x8f0553207e486D2C6f0636bf8f67D4D76EB84656",
    ticketsMarketplace: "0x4f506bdE33C7B0C55694642c8b123aC85913C5E7",
    membership: 	"0x64bC7bB5A73563657bE31e832aB1937617cEAA1D",
    membershipsMarketplace: "0xAa263Fc559871bD019d01cae1Cc9C0FDB6d7ec5d",
  },
  [Network.MUMBAI]: {
    admin: "0x447C4DAd5b8257d8C53Ea95e472aAc9eA98ADDaf",
    event: "0x6495e00cD5B3631455FC6085aA9C36a849ad6e50",
    ticket: 	"0xd18Ce9e4ec21ED39C50BfB63d40a5c0C591e238B",
    ticketsMarketplace: "0x8193dEbbeA93238aeB710442b122D6B747DB24C4",
    membership: 	"0xF94F58EBA614a78118Cba0667F22268f478c88B8",
    membershipsMarketplace: "0xcB2C094d7C01111341d192D0c40dCE1Dbcbdd3dd",
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
        this.startBlocks['default'] || this.startBlocks[contractName]
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