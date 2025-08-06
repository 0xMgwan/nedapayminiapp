// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title NedaPayProtocolUpgradeable
 * @dev Upgradeable protocol fee contract with dynamic tiered fee structure
 * @author NedaPay Team
 */
contract NedaPayProtocolUpgradeable is 
    Initializable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    // Constants
    address public constant FEE_RECIPIENT = 0x037Eb04AD9DDFf984F44Ce5941D14b8Ea3781459;
    uint256 public constant BASIS_POINTS = 10000; // 100%
    
    // Fee tier structure
    struct FeeTier {
        uint256 minAmount; // Minimum USD amount for this tier
        uint256 maxAmount; // Maximum USD amount for this tier (0 = no limit)
        uint256 feeRate;   // Fee rate in basis points
    }
    
    // State variables
    FeeTier[] public feeTiers;
    mapping(address => bool) public supportedTokens;
    mapping(address => uint256) public totalFeesCollected;
    mapping(address => mapping(address => uint256)) public userFeeContributions;
    
    // Events
    event PaymentProcessed(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 fee,
        string paymentType
    );
    
    event SwapProcessed(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 fee
    );
    
    event FeeTiersUpdated();
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event FeesWithdrawn(address indexed token, uint256 amount);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initialize the contract (replaces constructor for upgradeable contracts)
     */
    function initialize() public initializer {
        __ReentrancyGuard_init();
        __Ownable_init(msg.sender);
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        // Initialize default fee tiers
        _initializeFeeTiers();
        
        // Initialize supported tokens
        _initializeSupportedTokens();
    }
    
    /**
     * @dev Initialize default fee tiers
     */
    function _initializeFeeTiers() private {
        // $0 - $100: 1.0%
        feeTiers.push(FeeTier({
            minAmount: 0,
            maxAmount: 100 * 1e18, // $100 in wei (assuming 18 decimals)
            feeRate: 100 // 1.0%
        }));
        
        // $101 - $500: 0.75%
        feeTiers.push(FeeTier({
            minAmount: 100 * 1e18 + 1,
            maxAmount: 500 * 1e18,
            feeRate: 75 // 0.75%
        }));
        
        // $501 - $2,000: 0.5%
        feeTiers.push(FeeTier({
            minAmount: 500 * 1e18 + 1,
            maxAmount: 2000 * 1e18,
            feeRate: 50 // 0.5%
        }));
        
        // $2,001 - $5,000: 0.3%
        feeTiers.push(FeeTier({
            minAmount: 2000 * 1e18 + 1,
            maxAmount: 5000 * 1e18,
            feeRate: 30 // 0.3%
        }));
        
        // $5,001+: 0.2%
        feeTiers.push(FeeTier({
            minAmount: 5000 * 1e18 + 1,
            maxAmount: 0, // No upper limit
            feeRate: 20 // 0.2%
        }));
    }
    
    /**
     * @dev Initialize supported stablecoins
     */
    function _initializeSupportedTokens() private {
        // Base network stablecoins - CORRECTED ADDRESSES
        address[11] memory tokens = [
            0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, // USDC
            0x46C85152bFe9f96829aA94755D9f915F9B10EF5F, // cNGN - CORRECTED
            0xe743f13623E000261b634f0e5676F294475ec24d, // NGNC - CORRECTED
            0xb755506531786C8aC63B756BaB1ac387bACB0C04, // ZARP - CORRECTED
            0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22, // IDRX - CORRECTED
            0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42, // EURC - CORRECT
            0x043eB4B75d0805c43D7C834902E335621983Cf03, // CADC - CORRECTED
            0xE9185Ee218cae427aF7B9764A011bb89FeA761B4, // BRL - CORRECTED
            0xFb8718a69aed7726AFb3f04D2Bd4bfDE1BdCb294, // TRYB - CORRECTED
            0x2dD087589ce9C5b2D1b42e20d2519B3c8cF022b7, // NZDD - CORRECTED
            0x269caE7Dc59803e5C596c95756faEeBb6030E0aF  // MXNe - CORRECTED
        ];
        
        for (uint256 i = 0; i < tokens.length; i++) {
            supportedTokens[tokens[i]] = true;
        }
    }
    
    /**
     * @dev Calculate fee based on USD amount using dynamic tiers
     * @param token Token address
     * @param amount Token amount
     * @return fee Fee amount in token units
     */
    function calculateFee(address token, uint256 amount) public view returns (uint256 fee) {
        require(supportedTokens[token], "Token not supported");
        
        // Convert token amount to USD (simplified - assumes 1:1 for stablecoins)
        uint256 usdAmount = _convertToUSD(token, amount);
        
        // Find appropriate fee tier
        uint256 feeRate = _getFeeRate(usdAmount);
        
        // Calculate fee
        fee = (amount * feeRate) / BASIS_POINTS;
        
        return fee;
    }
    
    /**
     * @dev Get fee rate for USD amount
     * @param usdAmount USD amount in wei
     * @return feeRate Fee rate in basis points
     */
    function _getFeeRate(uint256 usdAmount) private view returns (uint256 feeRate) {
        for (uint256 i = 0; i < feeTiers.length; i++) {
            FeeTier memory tier = feeTiers[i];
            
            // Check if amount falls within this tier
            if (usdAmount >= tier.minAmount && 
                (tier.maxAmount == 0 || usdAmount <= tier.maxAmount)) {
                return tier.feeRate;
            }
        }
        
        // Fallback to highest tier rate if no match
        return feeTiers[feeTiers.length - 1].feeRate;
    }
    
    /**
     * @dev Convert token amount to USD (simplified for stablecoins)
     * @param token Token address
     * @param amount Token amount
     * @return usdAmount USD amount in wei
     */
    function _convertToUSD(address token, uint256 amount) private pure returns (uint256) {
        // Simplified conversion - assumes all supported tokens are USD-pegged stablecoins
        // In production, this would integrate with Chainlink oracles for accurate pricing
        token; // Silence unused parameter warning
        return amount;
    }
    
    /**
     * @dev Process payment with fee collection
     * @param token Token address
     * @param amount Payment amount (including fee)
     * @param paymentType Type of payment (e.g., "invoice", "send")
     */
    function processPayment(
        address token,
        uint256 amount,
        string calldata paymentType
    ) external nonReentrant whenNotPaused {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be greater than 0");
        
        IERC20 tokenContract = IERC20(token);
        
        // Calculate dynamic fee
        uint256 fee = calculateFee(token, amount);
        uint256 netAmount = amount - fee;
        
        // Transfer tokens from user
        require(
            tokenContract.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        
        // Transfer fee to protocol
        require(
            tokenContract.transfer(FEE_RECIPIENT, fee),
            "Fee transfer failed"
        );
        
        // Transfer net amount back to user (in a real implementation, this would go to the recipient)
        require(
            tokenContract.transfer(msg.sender, netAmount),
            "Net amount transfer failed"
        );
        
        // Update tracking
        totalFeesCollected[token] += fee;
        userFeeContributions[msg.sender][token] += fee;
        
        emit PaymentProcessed(msg.sender, token, amount, fee, paymentType);
    }
    
    /**
     * @dev Process swap with fee collection
     * @param tokenIn Input token address
     * @param tokenOut Output token address (for tracking)
     * @param amountIn Input amount (including fee)
     * Note: amountOutMin and swapData parameters are unused in this simplified version
     */
    function processSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 /* amountOutMin */,
        bytes calldata /* swapData */
    ) external nonReentrant whenNotPaused {
        require(supportedTokens[tokenIn], "Input token not supported");
        require(supportedTokens[tokenOut], "Output token not supported");
        require(amountIn > 0, "Amount must be greater than 0");
        
        IERC20 tokenInContract = IERC20(tokenIn);
        
        // Calculate dynamic fee based on input amount
        uint256 fee = calculateFee(tokenIn, amountIn);
        uint256 netAmountIn = amountIn - fee;
        
        // Transfer tokens from user
        require(
            tokenInContract.transferFrom(msg.sender, address(this), amountIn),
            "Transfer failed"
        );
        
        // Transfer fee to protocol
        require(
            tokenInContract.transfer(FEE_RECIPIENT, fee),
            "Fee transfer failed"
        );
        
        // In a real implementation, you would:
        // 1. Use the netAmountIn for the actual swap
        // 2. Execute swap through DEX router
        // 3. Transfer output tokens to user
        // For now, we'll just transfer the net amount back (minus fee)
        require(
            tokenInContract.transfer(msg.sender, netAmountIn),
            "Swap return failed"
        );
        
        // Update tracking
        totalFeesCollected[tokenIn] += fee;
        userFeeContributions[msg.sender][tokenIn] += fee;
        
        emit SwapProcessed(msg.sender, tokenIn, tokenOut, amountIn, fee);
    }
    
    /**
     * @dev Get net amount after fee deduction
     * @param token Token address
     * @param amount Gross amount
     * @return netAmount Amount after fee deduction
     */
    function getNetAmount(address token, uint256 amount) external view returns (uint256 netAmount) {
        uint256 fee = calculateFee(token, amount);
        return amount - fee;
    }
    
    /**
     * @dev Check if token is supported
     * @param token Token address
     * @return supported Whether token is supported
     */
    function isTokenSupported(address token) external view returns (bool supported) {
        return supportedTokens[token];
    }
    
    /**
     * @dev Get total fees collected for a token
     * @param token Token address
     * @return total Total fees collected
     */
    function getTotalFeesCollected(address token) external view returns (uint256 total) {
        return totalFeesCollected[token];
    }
    
    /**
     * @dev Get user's fee contribution for a token
     * @param user User address
     * @param token Token address
     * @return contribution User's total fee contribution
     */
    function getUserFeeContribution(address user, address token) external view returns (uint256 contribution) {
        return userFeeContributions[user][token];
    }
    
    // ADMIN FUNCTIONS
    
    /**
     * @dev Update fee tiers (owner only)
     * @param newTiers Array of new fee tiers
     */
    function updateFeeTiers(FeeTier[] calldata newTiers) external onlyOwner {
        require(newTiers.length > 0, "Must have at least one tier");
        
        // Clear existing tiers
        delete feeTiers;
        
        // Add new tiers
        for (uint256 i = 0; i < newTiers.length; i++) {
            require(newTiers[i].feeRate <= 1000, "Fee rate cannot exceed 10%"); // Max 10%
            feeTiers.push(newTiers[i]);
        }
        
        emit FeeTiersUpdated();
    }
    
    /**
     * @dev Emergency withdrawal (owner only)
     * @param token Token to withdraw
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20 tokenContract = IERC20(token);
        require(
            tokenContract.transfer(owner(), amount),
            "Emergency withdrawal failed"
        );
        
        emit FeesWithdrawn(token, amount);
    }
    
    /**
     * @dev Pause contract (owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Get number of fee tiers
     * @return Number of fee tiers
     */
    function getFeeTiersLength() external view returns (uint256) {
        return feeTiers.length;
    }
    
    /**
     * @dev Add supported token (owner only)
     * @param token Token address to add
     */
    function addSupportedToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(!supportedTokens[token], "Token already supported");
        
        supportedTokens[token] = true;
        emit TokenAdded(token);
    }
    
    /**
     * @dev Remove supported token (owner only)
     * @param token Token address to remove
     */
    function removeSupportedToken(address token) external onlyOwner {
        require(supportedTokens[token], "Token not supported");
        
        supportedTokens[token] = false;
        emit TokenRemoved(token);
    }
    
    /**
     * @dev Initialize all supported tokens (owner only) - for upgrades
     */
    function initializeSupportedTokens() external onlyOwner {
        // Base network stablecoins - CORRECTED ADDRESSES
        address[11] memory tokens = [
            0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, // USDC
            0x46C85152bFe9f96829aA94755D9f915F9B10EF5F, // cNGN - CORRECTED
            0xe743f13623E000261b634f0e5676F294475ec24d, // NGNC - CORRECTED
            0xb755506531786C8aC63B756BaB1ac387bACB0C04, // ZARP - CORRECTED
            0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22, // IDRX - CORRECTED
            0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42, // EURC - CORRECT
            0x043eB4B75d0805c43D7C834902E335621983Cf03, // CADC - CORRECTED
            0xE9185Ee218cae427aF7B9764A011bb89FeA761B4, // BRL - CORRECTED
            0xFb8718a69aed7726AFb3f04D2Bd4bfDE1BdCb294, // TRYB - CORRECTED
            0x2dD087589ce9C5b2D1b42e20d2519B3c8cF022b7, // NZDD - CORRECTED
            0x269caE7Dc59803e5C596c95756faEeBb6030E0aF  // MXNe - CORRECTED
        ];
        
        for (uint256 i = 0; i < tokens.length; i++) {
            if (!supportedTokens[tokens[i]]) {
                supportedTokens[tokens[i]] = true;
                emit TokenAdded(tokens[i]);
            }
        }
    }
    
    /**
     * @dev Required by UUPSUpgradeable
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    /**
     * @dev Get contract version
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}
