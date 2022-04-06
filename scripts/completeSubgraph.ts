
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
    ticket = 'ticket',
    event = 'event',
}

const startBlockByNetwork: Record<Network, Record<string, number>> = {
    [Network.MATIC]: {
      marketplace: 25657775,
      ticket: 	25657919,
      event:   25657919,  
    },
    [Network.MUMBAI]: {
      marketplace: 25731086,
      ticket: 25731084,
      event: 25731084
    }
}

const contractAddressByNetwork: Record<Network, Record<string, string>> = {
    [Network.MATIC]: {
      marketplace: "0xB47c1BE646F7C5f180424f6198E038a4071B9c46",
      ticket: 	"0xAec844771035Bee7e174D5c382703FF0cDE53B9d",
      event: "0x96338E94520977C0523599F6Ccf0e388c120d867"
    },
    [Network.MUMBAI]: {
      marketplace: "0x67bf152A179b5710a323E0Dc6c9ac6D4c528CCf2",
      ticket: "0xB592f4A053129593AAC9493661A1B8057fb659DF",
      event: "0x287B9409468376924651AA2534BC051D48555020"
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