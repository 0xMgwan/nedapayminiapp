# NedaPay MiniApp 🚀

A comprehensive Farcaster MiniApp for seamless crypto payments, built on Base network with USDC integration.

## 🌟 Features

### Core Functionality
- **Send Money**: Transfer USDC to phone numbers across multiple countries
- **Pay Bills**: Pay for goods, services, and bills using USDC
- **Deposit/Buy**: Purchase USDC using local currencies
- **Payment Links**: Generate shareable payment request links
- **Real-time Rates**: Live exchange rates for multiple currencies

### Advanced Features
- **Multi-country Support**: Tanzania, Kenya, Nigeria, Uganda, Ghana, and more
- **Farcaster Integration**: Native MiniApp experience within Farcaster
- **Wallet Integration**: Seamless connection with Farcaster custody wallets
- **QR Code Generation**: EIP-681 compatible QR codes for wallet scanning
- **Transaction History**: Complete payment tracking and history
- **Responsive Design**: Mobile-first, premium UI/UX

## 🛠 Tech Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom animations
- **Blockchain**: Base network (Ethereum L2)
- **Wallet**: Privy Auth + Coinbase OnchainKit MiniKit
- **Payments**: Paycrest API integration
- **Database**: Prisma with PostgreSQL
- **Deployment**: Vercel

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Farcaster account with custody wallet

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/0xMgwan/nedapayminiapp.git
   cd nedapayminiapp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create `.env.local` file:
   ```env
   # Privy Configuration
   NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
   PRIVY_APP_SECRET=your_privy_app_secret

   # Coinbase OnchainKit
   NEXT_PUBLIC_ONCHAINKIT_API_KEY=your_onchainkit_api_key

   # Paycrest API
   PAYCREST_API_KEY=your_paycrest_api_key
   PAYCREST_BASE_URL=https://api.paycrest.io

   # Database
   DATABASE_URL=your_postgresql_url

   # Farcaster MiniApp (Generated via npx create-onchain --manifest)
   FARCASTER_HEADER=your_farcaster_header
   FARCASTER_PAYLOAD=your_farcaster_payload
   FARCASTER_SIGNATURE=your_farcaster_signature
   NEXT_PUBLIC_URL=your_deployment_url
   ```

4. **Database Setup**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Run Development Server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3001](http://localhost:3001) to view the app.

## 📱 MiniApp Structure

### Main Routes
- `/farcaster` - Main MiniApp interface
- `/payment-request` - Payment request handler
- `/.well-known/farcaster.json` - Farcaster manifest

### Key Components
- **MiniKitProvider**: Farcaster MiniKit integration
- **Premium UI Components**: Custom buttons, tabs, and animations
- **Payment Processing**: USDC transactions on Base network
- **Multi-currency Support**: Real-time exchange rates

## 🔧 Development

### Generate Farcaster Manifest
```bash
npx create-onchain --manifest
```

### Build for Production
```bash
npm run build
```

### Run Tests
```bash
npm test
```

## 🌍 Supported Countries & Currencies

| Country | Currency | Flag |
|---------|----------|------|
| Tanzania | TZS | 🇹🇿 |
| Kenya | KES | 🇰🇪 |
| Nigeria | NGN | 🇳🇬 |
| Uganda | UGX | 🇺🇬 |
| Ghana | GHS | 🇬🇭 |

## 🔐 Security Features

- **Wallet Security**: Farcaster custody wallet integration
- **Transaction Signing**: Real wallet signatures required
- **API Security**: Secure Paycrest API integration
- **Environment Variables**: Sensitive data protection

## 📊 API Integration

### Paycrest API
- **Onramp**: Buy USDC with local currencies
- **Offramp**: Convert USDC to local currencies
- **Payment Processing**: Handle bill payments and transfers

### Exchange Rates
- Real-time currency conversion
- Multiple provider fallbacks
- Cached rates for performance

## 🎨 UI/UX Features

- **Premium Animations**: Smooth transitions and hover effects
- **Dark Theme**: Consistent with Farcaster design
- **Mobile Responsive**: Optimized for mobile devices
- **Brand Integration**: Base and USDC logos throughout
- **Accessibility**: WCAG compliant design

## 🚀 Deployment

### Vercel Deployment
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Environment Variables for Production
Ensure all environment variables are set in your deployment platform.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Live Demo**: [Your Deployment URL]
- **Farcaster Frame**: [Your Frame URL]
- **Documentation**: [Your Docs URL]

## 👨‍💻 Developer

Built by [David Machuche](https://github.com/0xMgwan)

## 🙏 Acknowledgments

- Farcaster team for MiniKit
- Base network for infrastructure
- Coinbase for OnchainKit
- Paycrest for payment processing

---

**Made with ❤️ for the Farcaster ecosystem**