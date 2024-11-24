# Environment Setup and Configuration

## Prerequisites

Before setting up PayKit, ensure you have the following installed:
- Node.js (v16.x or later)
- npm (v8.x or later)
- PostgreSQL (v14.x or later)
- Git

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Next.js
NEXT_PUBLIC_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Email (Resend)
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM_ADDRESS=your_verified_email_address

# Security
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/paykit.git
cd paykit
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
# Create database tables and functions
npm run db:setup

# Run migrations
npm run db:migrate
```

4. Start the development server:
```bash
npm run dev
```

## Development Environment

The development server will be available at `http://localhost:3000`.

### Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build production bundle
- `npm run start`: Start production server
- `npm run lint`: Run ESLint
- `npm run test`: Run tests
- `npm run db:setup`: Set up database tables and functions
- `npm run db:migrate`: Run database migrations
- `npm run db:seed`: Seed database with sample data
- `npm run stripe:listen`: Start Stripe webhook listener

## Production Environment

For production deployment, additional environment variables are required:

```bash
NODE_ENV=production
DATABASE_URL=your_production_database_url
NEXT_PUBLIC_URL=https://your-domain.com
```

### Production Deployment Steps

1. Build the application:
```bash
npm run build
```

2. Run database migrations:
```bash
npm run db:migrate
```

3. Start the server:
```bash
npm run start
```

## Security Considerations

1. **API Keys**:
   - Never commit `.env` files
   - Rotate keys regularly
   - Use different keys for development and production

2. **Database**:
   - Enable SSL for database connections
   - Use strong passwords
   - Regular backups
   - RLS policies enabled by default

3. **Authentication**:
   - Session-based authentication
   - CSRF protection enabled
   - Rate limiting on auth endpoints
   - Password complexity requirements

## Monitoring and Logging

1. **Application Logs**:
   - Logs stored in `/logs` directory
   - Log rotation enabled
   - Different log levels (debug, info, warn, error)

2. **Error Tracking**:
   - Sentry integration for error tracking
   - Error notifications via email
   - Custom error boundaries for React components

3. **Performance Monitoring**:
   - New Relic APM integration
   - Database query performance tracking
   - API endpoint response time monitoring

## Troubleshooting

### Common Issues

1. **Database Connection Issues**:
```bash
# Check database connection
npm run db:check

# Reset database connection
npm run db:reset
```

2. **Stripe Webhook Issues**:
```bash
# Start webhook listener in debug mode
stripe listen --debug
```

3. **Build Issues**:
```bash
# Clear Next.js cache
rm -rf .next

# Clean install dependencies
rm -rf node_modules
npm install
```

### Debug Mode

Enable debug mode by setting:
```bash
DEBUG=paykit:*
```

This will provide detailed logging for all PayKit components.

## Maintenance

### Regular Tasks

1. **Database Maintenance**:
   - Weekly vacuum analyze
   - Monthly index rebuilds
   - Quarterly performance review

2. **Security Updates**:
   - Weekly dependency updates
   - Monthly security audits
   - Quarterly penetration testing

3. **Backup Schedule**:
   - Daily incremental backups
   - Weekly full backups
   - Monthly backup verification

## Support

For technical support:
1. Check the troubleshooting guide above
2. Search existing GitHub issues
3. Create a new issue with:
   - Environment details
   - Steps to reproduce
   - Expected vs actual behavior
   - Relevant logs
