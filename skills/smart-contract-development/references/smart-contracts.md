# Smart Contracts on VeChainThor (Solidity + Hardhat)

## When to use

Use when the user asks about: Solidity contracts, Hardhat setup, deployment, ERC-20, ERC-721, contract interaction with SDK, built-in contracts, VeChainThor EVM, libraries, contract size, upgradeable contracts.

## Core Advantages
- **EVM Compatibility**: VeChainThor runs standard Solidity contracts
- **Hardhat Integration**: Full Hardhat toolchain with VeChain network support
- **Fee Delegation**: Built-in support for gasless transactions
- **Multi-Clause**: Batch multiple operations in a single transaction

## Project Setup

### Initialize
```bash
mkdir my-vechain-project && cd my-vechain-project
npm init -y
npm install --save-dev hardhat @vechain/sdk-hardhat-plugin
npm install @openzeppelin/contracts
npx hardhat init
```

### Configuration (hardhat.config.ts)
```typescript
import '@vechain/sdk-hardhat-plugin';
import { VET_DERIVATION_PATH } from '@vechain/sdk-core';

const config = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'paris'  // VeChainThor aligns with paris EVM
    }
  },
  networks: {
    vechain_solo: {
      url: 'http://localhost:8669',
      accounts: {
        mnemonic: 'denial kitchen pet squirrel other broom bar gas better priority spoil cross',
        count: 3,
        path: VET_DERIVATION_PATH
      },
      debug: true,
      gas: 'auto',
      gasPrice: 'auto'
    },
    vechain_testnet: {
      url: 'https://testnet.vechain.org',
      accounts: {
        mnemonic: process.env.MNEMONIC || '',
        count: 3,
        path: VET_DERIVATION_PATH
      },
      debug: true,
      gas: 'auto',
      gasPrice: 'auto'
    },
    vechain_mainnet: {
      url: 'https://mainnet.vechain.org',
      accounts: [process.env.PRIVATE_KEY || ''],
      debug: false,
      gas: 'auto',
      gasPrice: 'auto'
    }
  }
};

export default config;
```

## EVM Version Compatibility

VeChainThor aligns with the `paris` EVM version. Always set:
```typescript
evmVersion: 'paris'
```

Opcodes introduced after Paris (e.g., `PUSH0` from Shanghai) are NOT supported.

## Common Contract Patterns

### ERC-20 Token (VIP-180 compatible)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, Ownable {
    constructor(
        uint256 initialSupply
    ) ERC20("MyToken", "MTK") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
```

### ERC-721 NFT (VIP-181 compatible)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    constructor() ERC721("MyNFT", "MNFT") Ownable(msg.sender) {}

    function safeMint(address to, string memory uri) public onlyOwner {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    // Required overrides
    function tokenURI(uint256 tokenId)
        public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
```

### Access Control Pattern
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract Governed is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function adminOnlyAction() external onlyRole(ADMIN_ROLE) {
        // ...
    }

    function operatorAction() external onlyRole(OPERATOR_ROLE) {
        // ...
    }
}
```

### Upgradeable Contract (UUPS)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract MyUpgradeable is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    uint256 public value;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(uint256 _value) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        value = _value;
    }

    function setValue(uint256 _value) external onlyOwner {
        value = _value;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
```

## Solidity Libraries

**Always prefer libraries** to keep contracts maintainable and under the 24KB contract size limit. Extract reusable or isolatable logic into libraries early.

### When to Use Libraries

- **Contract size**: Near the 24KB limit (check with `npx hardhat compile`)
- **Reuse**: Logic shared across contracts or that can be isolated
- **Readability**: Split large contracts into a main contract plus focused "Utils" libraries

### Two Kinds of Libraries

#### A) Storage-types library (not deployed)

Holds storage structs and `internal` getters that return `storage` via a fixed slot (ERC-7201). No `external` functions -- compiled into the contract, not deployed separately.

```solidity
// contracts/my-module/libraries/MyModuleStorageTypes.sol
library MyModuleStorageTypes {
    /// @custom:storage-location erc7201:mymodule.storage.main
    struct MainStorage {
        mapping(bytes32 => uint256) values;
        uint256 counter;
    }

    bytes32 private constant MainStorageLocation =
        0x...; // keccak256(abi.encode(uint256(keccak256("mymodule.storage.main")) - 1)) & ~bytes32(uint256(0xff))

    function _getMainStorage() internal pure returns (MainStorage storage s) {
        bytes32 location = MainStorageLocation;
        assembly { s.slot := location }
    }
}
```

#### B) Utils libraries (deployed and linked)

Contain `external` functions with real logic. Read/write the same storage as the main contract via the storage-types library. Deployed separately; main contract calls them as `LibraryName.functionName(...)`.

```solidity
// contracts/my-module/libraries/ValidationUtils.sol
library ValidationUtils {
    error InvalidInput(bytes32 id);

    function validate(bytes32 id) external view returns (bool) {
        MyModuleStorageTypes.MainStorage storage s = MyModuleStorageTypes._getMainStorage();
        if (s.values[id] == 0) revert InvalidInput(id);
        return true;
    }
}
```

### Project Layout

```
contracts/
├── my-module/
│   ├── MyModule.sol                    # Main contract (thin facade)
│   └── libraries/
│       ├── MyModuleStorageTypes.sol     # Storage structs + internal slot getters (not deployed)
│       ├── ValidationUtils.sol         # External logic library (deployed)
│       └── ProcessingUtils.sol         # External logic library (deployed)
├── libraries/
│   └── SharedDataTypes.sol             # Types shared across modules
└── interfaces/
    └── IMyModule.sol
```

### Main Contract Pattern

```solidity
import "./libraries/MyModuleStorageTypes.sol";
import "./libraries/ValidationUtils.sol";
import "./libraries/ProcessingUtils.sol";

contract MyModule is Initializable, UUPSUpgradeable, AccessControlUpgradeable {
    using MyModuleStorageTypes for *;

    function doSomething(bytes32 id) external onlyRole(OPERATOR_ROLE) {
        ValidationUtils.validate(id);       // Delegated to library
        ProcessingUtils.process(id);        // Delegated to library
    }
}
```

- Access control and modifiers stay in the main contract
- Libraries only get storage and do the logic
- No `using` for deployed (external) libraries -- call directly

### Deployment with Library Linking

Deploy Utils libraries first, then link them when deploying the main contract:

```typescript
// scripts/libraries/myModuleLibraries.ts
export async function deployMyModuleLibraries() {
  const ValidationUtils = await ethers.deployContract('ValidationUtils');
  await ValidationUtils.waitForDeployment();

  const ProcessingUtils = await ethers.deployContract('ProcessingUtils');
  await ProcessingUtils.waitForDeployment();

  return {
    ValidationUtils: await ValidationUtils.getAddress(),
    ProcessingUtils: await ProcessingUtils.getAddress(),
  };
}

// scripts/deploy.ts
const libs = await deployMyModuleLibraries();

const MyModule = await ethers.getContractFactory('MyModule', {
  libraries: {
    ValidationUtils: libs.ValidationUtils,
    ProcessingUtils: libs.ProcessingUtils,
  },
});
```

Use the **same** `libraries` object for both deploy and upgrade of the implementation.

### Upgrade Rules

- **Redeploy all libraries** when upgrading the main contract version
- Pass the new library addresses in `options.libraries` to `upgradeProxy`
- For upgrade tests, keep deprecated contract/library versions under `contracts/deprecated/V{N}/` so you can deploy V(N-1) and upgrade to V(N)

### Storage Safety

- **Never** change order, remove, or change types of existing storage variables
- Only **append** new fields at the end of storage structs
- This applies to both the storage-types library and the main contract

### Library Style

- Use **custom errors** (e.g., `error NonexistentItem(bytes32 id);`)
- Emit **events** in the library when the event is part of the module's API
- Use NatSpec (`@title`, `@dev`) on each library and public/external functions
- Keep imports minimal and directional (e.g., `../../interfaces/`, `./StorageTypes.sol`)

### Quick Checklist for Adding a New Utils Library

1. Create `contracts/<module>/libraries/<Name>Utils.sol` with `external` functions
2. Access storage only via the module's storage-types library
3. Add to the module's library deployment script and include in the returned object
4. Add library name + address to the `libraries` map for `getContractFactory`
5. Import in the main contract and call `NewUtils.functionName(...)`
6. Do not add or change storage layout in the main contract -- keep new storage in the storage-types library, append only

---

## Deployment

### Deployment Script
```typescript
import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with:', deployer.address);

  const MyToken = await ethers.deployContract('MyToken', [1_000_000]);
  await MyToken.waitForDeployment();
  console.log('MyToken deployed to:', await MyToken.getAddress());
}

main().catch(console.error);
```

### Deploy Commands
```bash
# Local (Thor Solo)
npx hardhat run scripts/deploy.ts --network vechain_solo

# Testnet
npx hardhat run scripts/deploy.ts --network vechain_testnet

# Mainnet
npx hardhat run scripts/deploy.ts --network vechain_mainnet
```

### Deploy with Fee Delegation

Add a `delegate` config to the network. See [fee-delegation.md](fee-delegation.md) for full setup.

## Contract Interaction with SDK

### Read from contract
```typescript
import { ThorClient } from '@vechain/sdk-network';

const thorClient = ThorClient.at('https://testnet.vechain.org');
const contract = thorClient.contracts.load(contractAddress, contractABI);

const balance = await contract.read.balanceOf(someAddress);
const name = await contract.read.name();
```

### Write to contract (backend/scripts)
```typescript
import { ThorClient, VeChainProvider, ProviderInternalBaseWallet } from '@vechain/sdk-network';

const thorClient = ThorClient.at('https://testnet.vechain.org');
const wallet = new ProviderInternalBaseWallet([
  { privateKey: HexUInt.of(privateKey).bytes, address: senderAddress }
]);
const provider = new VeChainProvider(thorClient, wallet);
const signer = await provider.getSigner(senderAddress);

const contract = thorClient.contracts.load(contractAddress, contractABI, signer);
const tx = await contract.transact.transfer(recipientAddress, amount);
```

### Batch reads with multi-clause
```typescript
const results = await thorClient.contracts.executeMultipleClausesCall([
  contract.clause.totalSupply(),
  contract.clause.name(),
  contract.clause.symbol(),
  contract.clause.decimals()
]);
```

## VeChain-Specific Considerations

### Dual Token Model
- **VET**: Value transfer token. Transfer with `Clause.transferVET()`.
- **VTHO**: Gas token. Generated by staking VET. Transfer with `Clause.transferVTHOToken()`.
- VTHO contract address: `0x0000000000000000000000000000456E65726779`

### Built-in Contracts
VeChainThor has several built-in contracts at genesis:
- **Authority**: `0x0000000000000000000000417574686f72697479` - Authority node management
- **Energy (VTHO)**: `0x0000000000000000000000000000456E65726779` - VTHO token
- **Params**: `0x0000000000000000000000000000506172616d73` - Network parameters
- **Executor**: `0x0000000000000000000000004578656375746f72` - On-chain governance
- **Extension**: `0x0000000000000000000000457874656e73696f6e` - Extended functionality

### Block Time
VeChainThor produces blocks every ~10 seconds (vs Ethereum's ~12 seconds). With Thor Solo `--on-demand`, blocks are produced only when transactions are pending.

## Security Best Practices

### Input Validation
- Use `require` statements for all external input validation
- Use OpenZeppelin's `ReentrancyGuard` for functions that transfer value
- Validate addresses are non-zero with `require(addr != address(0))`

### Access Control
- Prefer OpenZeppelin's `AccessControl` over custom role management
- Use `Ownable2Step` over `Ownable` for safer ownership transfers
- Never use `tx.origin` for authorization

### Common Gotchas
- **EVM version**: Always use `paris`. Newer opcodes will cause deployment failures.
- **Gas estimation**: Use `gas: 'auto'` in Hardhat config for VeChain's gas model.
- **Block timestamps**: VeChain has ~10s block time; do not rely on sub-second precision.
- **Chain ID**: Mainnet is `0x4a` (74), testnet is `0x27` (39).
