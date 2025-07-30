# NedaPay MiniApp Deployment Guide 🚀

This guide covers the complete deployment process for the NedaPay MiniApp to Vercel with Farcaster integration.

## 📋 Pre-Deployment Checklist

### 1. Environment Variables Setup
Ensure you have all required environment variables:

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

# Farcaster MiniApp Manifest
FARCASTER_HEADER=your_farcaster_header
FARCASTER_PAYLOAD=your_farcaster_payload
FARCASTER_SIGNATURE=your_farcaster_signature
NEXT_PUBLIC_URL=https://your-deployment-url.vercel.app
```

### 2. Database Setup
- Ensure PostgreSQL database is ready
- Run migrations: `npx prisma db push`
- Verify database connection

### 3. Build Test
```bash
npm run build
```
Ensure the build completes without errors.

## 🌐 Vercel Deployment

### Step 1: Connect Repository
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import from GitHub: `https://github.com/0xMgwan/nedapayminiapp.git`
4. Select the repository

### Step 2: Configure Project Settings
- **Framework Preset**: Next.js
- **Root Directory**: `./` (default)
- **Build Command**: `npm run build`
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install`

### Step 3: Environment Variables
Add all environment variables in Vercel dashboard:
1. Go to Project Settings → Environment Variables
2. Add each variable from your `.env.local`
3. Set appropriate environments (Production, Preview, Development)

### Step 4: Domain Configuration
1. After deployment, note your Vercel URL
2. Update `NEXT_PUBLIC_URL` environment variable with your Vercel URL
3. Redeploy to apply changes

## 🔧 Farcaster Manifest Configuration

### Step 1: Generate Manifest
After deployment, generate your Farcaster manifest:

```bash
npx create-onchain --manifest
```

### Step 2: Update Environment Variables
1. Copy the generated `FARCASTER_HEADER`, `FARCASTER_PAYLOAD`, and `FARCASTER_SIGNATURE`
2. Update these in Vercel environment variables
3. Redeploy

### Step 3: Verify Manifest
Visit `https://your-app.vercel.app/.well-known/farcaster.json` to verify the manifest is accessible.

## 🔍 Post-Deployment Verification

### 1. Health Checks
- [ ] App loads correctly at your Vercel URL
- [ ] Farcaster manifest is accessible
- [ ] Wallet connection works
- [ ] Payment flows function properly
- [ ] Database connections are stable

### 2. Farcaster Integration Test
1. Open your MiniApp URL in Warpcast
2. Test wallet connection
3. Verify payment link generation
4. Test USDC transactions

### 3. Performance Checks
- [ ] Lighthouse score > 90
- [ ] Core Web Vitals are green
- [ ] Mobile responsiveness verified

## 🚨 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

#### Environment Variable Issues
- Ensure all variables are set in Vercel
- Check variable names match exactly
- Verify sensitive variables are not exposed to client

#### Database Connection Issues
- Verify DATABASE_URL format
- Check database permissions
- Ensure database is accessible from Vercel

#### Farcaster Manifest Issues
- Verify manifest endpoint returns valid JSON
- Check CORS headers
- Ensure manifest is signed correctly

### Debug Commands
```bash
# Check build locally
npm run build

# Verify environment variables
npm run dev

# Test database connection
npx prisma db push
```

## 📊 Monitoring & Analytics

### Vercel Analytics
Enable Vercel Analytics for performance monitoring:
1. Go to Project Settings → Analytics
2. Enable Web Analytics
3. Monitor Core Web Vitals

### Error Tracking
Consider integrating error tracking:
- Sentry for error monitoring
- LogRocket for session replay
- Custom logging for payment flows

## 🔄 Continuous Deployment

### Automatic Deployments
Vercel automatically deploys on:
- Push to `main` branch (Production)
- Push to other branches (Preview)

### Manual Deployments
```bash
# Deploy to production
vercel --prod

# Deploy preview
vercel
```

## 🔐 Security Considerations

### Environment Variables
- Never commit `.env` files
- Use Vercel's environment variable encryption
- Rotate API keys regularly

### API Security
- Implement rate limiting
- Validate all inputs
- Use HTTPS only

### Wallet Security
- Verify wallet signatures
- Implement transaction limits
- Monitor for suspicious activity

## 📈 Performance Optimization

### Next.js Optimizations
- Enable Image Optimization
- Use dynamic imports for heavy components
- Implement proper caching strategies

### Database Optimization
- Use connection pooling
- Implement query optimization
- Monitor database performance

## 🎯 Go-Live Checklist

- [ ] All environment variables configured
- [ ] Database migrations completed
- [ ] Farcaster manifest generated and verified
- [ ] SSL certificate active
- [ ] Custom domain configured (if applicable)
- [ ] Analytics and monitoring enabled
- [ ] Error tracking configured
- [ ] Performance optimized
- [ ] Security measures implemented
- [ ] Backup strategy in place

## 📞 Support

For deployment issues:
1. Check Vercel deployment logs
2. Review Next.js build output
3. Verify environment variables
4. Test locally first
5. Contact support if needed

---

**Happy Deploying! 🚀**
