// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EnergyNFT is ERC721URIStorage, Ownable {
    uint256 private _tokenIds;
    mapping(address => uint256) public userEnergyBalances;
    mapping(uint256 => uint256) public tokenEnergyAmount;
    
    address public marketplaceAddress;
    
    // --- THÊM MỚI: Quản lý quyền Mint (cho Contract Lending) ---
    mapping(address => bool) public authorizedMinters;

    event EnergyNFTMinted(uint256 tokenId, address owner, string ipfsHash);
    event EnergyBalanceUpdated(address user, uint256 newBalance);
    event EnergyProduced(address user, uint256 amount);
    event MarketplaceAddressUpdated(address newMarketplace);
    event MinterStatusUpdated(address minter, bool status);

    constructor() ERC721("Energy NFT", "ENFT") Ownable(msg.sender) {}

    modifier onlyMarketplace() {
        require(
            msg.sender == marketplaceAddress,
            "Only marketplace can call this function"
        );
        _;
    }

    // --- THÊM MỚI: Modifier kiểm tra quyền ---
    modifier onlyAuthorized() {
        require(
            msg.sender == owner() || authorizedMinters[msg.sender], 
            "Not authorized to mint energy"
        );
        _;
    }

    function setMarketplaceAddress(address _marketplaceAddress) external onlyOwner {
        require(_marketplaceAddress != address(0), "Invalid marketplace address");
        marketplaceAddress = _marketplaceAddress;
        emit MarketplaceAddressUpdated(_marketplaceAddress);
    }

    // --- THÊM MỚI: Hàm cấp quyền cho Contract khác ---
    function setMinter(address _minter, bool _status) external onlyOwner {
        authorizedMinters[_minter] = _status;
        emit MinterStatusUpdated(_minter, _status);
    }

    // --- SỬA ĐỔI: Thay onlyOwner thành onlyAuthorized ---
    function produceEnergy(address user, uint256 _energyAmount) external onlyAuthorized {
        userEnergyBalances[user] += _energyAmount;
        emit EnergyProduced(user, _energyAmount);
        emit EnergyBalanceUpdated(user, userEnergyBalances[user]);
    }

    function mint(address _from, string memory _tokenURI, uint256 _energyAmount) external returns (uint) {
        require(_energyAmount > 0, "Energy value should be greater than 0");
        require(userEnergyBalances[_from] >= _energyAmount, "Insufficient energy balance!!!");

        _tokenIds++;
        _safeMint(_from, _tokenIds);
        _setTokenURI(_tokenIds, _tokenURI);

        tokenEnergyAmount[_tokenIds] = _energyAmount;
        userEnergyBalances[_from] -= _energyAmount;

        emit EnergyNFTMinted(_tokenIds, _from, _tokenURI);
        emit EnergyBalanceUpdated(_from, userEnergyBalances[_from]);

        return (_tokenIds);
    }

    function transferEnergy(address _from, address _to, uint256 _tokenId) external onlyMarketplace {
        require(ownerOf(_tokenId) == _to, "Energy can only be transferred to NFT owner");

        uint256 energyAmount = tokenEnergyAmount[_tokenId];
        require(energyAmount > 0, "No energy associated with this NFT");

        userEnergyBalances[_to] += energyAmount;
        tokenEnergyAmount[_tokenId] = 0;

        emit EnergyBalanceUpdated(_from, userEnergyBalances[_from]);
        emit EnergyBalanceUpdated(_to, userEnergyBalances[_to]);
    }

    function getCurrentEnergy(address user) public view returns (uint256) {
        return userEnergyBalances[user];
    }
}