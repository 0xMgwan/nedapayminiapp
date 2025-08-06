// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title NedaPay Protocol Fee Contract (Upgradeable)
 * @dev Collects dynamic fees on payments, invoices, and swaps
 * @author NedaPay Team
 */
contract NedaPayProtocolUpgradeable is 
    Initializable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    // Protocol fee recipient
    address public constant FEE_RECIPIENT = 0x037Eb04AD9DDFf984F44Ce5941D14b8Ea3781459;
    
    // Dynamic fee configuration (basis points)
    uint256 public constant BASIS_POINTS = 10000;
    
    // Fee tiers based on USD amount (in 6 decimals like USDC)
    struct FeeTier {
        uint256 minAmount;  // Minimum amount in USD (6 decimals)
        uint256 maxAmount;  // Maximum amount in USD (6 decimals)
        uint256 feeRate;    // Fee rate in basis points
    }
    
    FeeTier[] public feeTiers;
    
    // Chainlink price feed for non-USD tokens (if needed)
    mapping(address => address) public priceFeeds;
    
    // Supported stablecoins
    mapping(address => bool) public supportedTokens;
    
    // Fee tracking
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
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event FeesWithdrawn(address indexed token, uint256 amount);
    event FeeTiersUpdated();
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize() public initializer {
        __ReentrancyGuard_init();
        __Ownable_init(msg.sender);
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        // Add all supported stablecoins on Base
        supportedTokens[0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913] = true; // USDC - USD Coin
        supportedTokens[0x46C85152bFe9f96829aA94755D9f915F9B10EF5F] = true; // cNGN - Nigerian Naira Coin
        supportedTokens[0xe743f13623E000261b634f0e5676F294475ec24d] = true; // NGNC - Nigerian Naira Coin
        supportedTokens[0xb755506531786C8aC63B756BaB1ac387bACB0C04] = true; // ZARP - South African Rand Coin
        supportedTokens[0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22] = true; // IDRX - Indonesian Rupiah Coin
        supportedTokens[0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42] = true; // EURC - Euro Coin
        supportedTokens[0x043eB4B75d0805c43D7C834902E335621983Cf03] = true; // CADC - Canadian Dollar Coin
        supportedTokens[0xE9185Ee218cae427aF7B9764A011bb89FeA761B4] = true; // BRL - Brazilian Real Coin
        supportedTokens[0xFb8718a69aed7726AFb3f04D2Bd4bfDE1BdCb294] = true; // TRYB - Turkish Lira Coin
        supportedTokens[0x2dD087589ce9C5b2D1b42e20d2519B3c8cF022b7] = true; // NZDD - New Zealand Dollar Coin
        supportedTokens[0x269caE7Dc59803e5C596c95756faEeBb6030E0aF] = true; // MXNe - Mexican Peso Coin
        
        // Initialize fee tiers
        _initializeFeeTiers();
    }
    
    /**
     * @dev Initialize fee tier structure
     */
    function _initializeFeeTiers() private {
        // Clear existing tiers (for upgrades)
        delete feeTiers;
        
        // $0–$100 → 1.0% (100 basis points)
        feeTiers.push(FeeTier({
            minAmount: 0,
            maxAmount: 100 * 10**6, // $100 in 6 decimals
            feeRate: 100
        }));
        
        // $101–$500 → 0.75% (75 basis points)
        feeTiers.push(FeeTier({
            minAmount: 100 * 10**6 + 1,
            maxAmount: 500 * 10**6, // $500 in 6 decimals
            feeRate: 75
        }));
        
        // $501–$2,000 → 0.5% (50 basis points)
        feeTiers.push(FeeTier({
            minAmount: 500 * 10**6 + 1,
            maxAmount: 2000 * 10**6, // $2,000 in 6 decimals
            feeRate: 50
        }));
        
        // $2,001–$5,000 → 0.3% (30 basis points)
        feeTiers.push(FeeTier({
            minAmount: 2000 * 10**6 + 1,
            maxAmount: 5000 * 10**6, // $5,000 in 6 decimals
            feeRate: 30
        }));
        
        // $5,001+ → 0.2% (20 basis points)
        feeTiers.push(FeeTier({
            minAmount: 5000 * 10**6 + 1,
            maxAmount: type(uint256).max, // No upper limit
            feeRate: 20
        }));
    }
    
    /**
     * @dev Calculate dynamic fee based on USD amount
     * @param usdAmount The amount in USD (6 decimals)
     * @return The fee rate in basis points
     */
    function calculateDynamicFeeRate(uint256 usdAmount) public view returns (uint256) {
        for (uint256 i = 0; i < feeTiers.length; i++) {
            if (usdAmount >= feeTiers[i].minAmount && usdAmount <= feeTiers[i].maxAmount) {
                return feeTiers[i].feeRate;
            }
        }
        // Default to highest tier if not found (shouldn't happen)
        return 20; // 0.2%
    }
    
    /**
     * @dev Calculate fee for a given amount
     * @param token The token address
     * @param amount The token amount
     * @return The fee amount in token units
     */
    function calculateFee(address token, uint256 amount) public view returns (uint256) {
        // For USD-based tokens (USDC, etc.), use amount directly
        // For other tokens, we'd need price conversion (simplified for now)
        uint256 usdAmount = _convertToUSD(token, amount);
        uint256 feeRate = calculateDynamicFeeRate(usdAmount);
        return (amount * feeRate) / BASIS_POINTS;
    }
    
    /**
     * @dev Convert token amount to USD equivalent (simplified)
     * @param token The token address
     * @param amount The token amount
     * @return The USD equivalent (6 decimals)
     */
    function _convertToUSD(address token, uint256 amount) private pure returns (uint256) {
        // For USDC and other USD stablecoins, return amount directly
        if (token == 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) { // USDC
            return amount; // Already in 6 decimals
        }
        
        // For other stablecoins, we'll approximate as 1:1 with USD for now
        // In production, you'd use Chainlink price feeds for accurate conversion
        return amount; // Simplified - treat all as USD equivalent
    }
    
    /**
     * @dev Process payment with fee collection
     * @param token The token address
     * @param recipient The payment recipient
     * @param amount The payment amount (including fee)
     * @param paymentType Type of payment: "payment", "invoice", or "swap"
     */
    function processPayment(
        address token,
        address recipient,
        uint256 amount,
        string memory paymentType
    ) external nonReentrant whenNotPaused {
        require(supportedTokens[token], "Token not supported");
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        
        IERC20 tokenContract = IERC20(token);
        
        // Calculate dynamic fee based on amount
        uint256 fee = calculateFee(token, amount);
        uint256 netAmount = amount - fee;
        
        // Transfer tokens from user to this contract
        require(
            tokenContract.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        
        // Transfer net amount to recipient
        require(
            tokenContract.transfer(recipient, netAmount),
            "Recipient transfer failed"
        );
        
        // Transfer fee to protocol
        require(
            tokenContract.transfer(FEE_RECIPIENT, fee),
            "Fee transfer failed"
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
