# Payment Plan Creation Flow

This document outlines the complete flow of creating a payment plan in PayKit, from initial form submission to final payment processing.

## Overview

The payment plan creation process is managed through several key components:
- Frontend wizard interface (`NewPlanWizard.tsx`)
- Plan details form (`PlanDetailsForm.tsx`)
- Payment method selection (`PaymentMethodChoice.tsx`)
- Stripe payment integration (`StripePaymentForm`)
- Multiple database functions for handling pending and active records

## Component Structure

### Entry Point
1. `page.tsx` - Next.js page component
2. `NewPlanPage.tsx` - Wraps the wizard with context provider
3. `NewPlanWizard.tsx` - Manages the multi-step wizard interface

### Core Components
- `NewPlanContext.tsx` - State management
- `PlanDetailsForm.tsx` - Step 1: Initial plan details
- `PaymentMethodChoice.tsx` - Step 2: Payment collection method
- `StripePaymentForm.tsx` - Step 3a: Immediate payment collection
- `EmailConfirmation.tsx` - Step 3b: Payment link confirmation
- `PaymentSchedule.tsx` - Side panel showing payment breakdown

## Detailed Flow

### Step 1: Plan Details Entry
The `PlanDetailsForm` component handles the initial data collection:

#### Required Information
- Customer Details:
  - Name (minimum 2 characters)
  - Email (valid email format)
- Payment Details:
  - Total Amount (> 0)
  - Number of Payments (≥ 1)
  - Payment Interval (weekly/monthly)
  - Down Payment Amount (optional, must be < total)
- Notes (optional, rich text editor)

#### Validation & Processing
- Real-time field validation
- Automatic payment schedule calculation
- Raw dollar/cents input without formatting
- Rich text notes using React Quill

#### State Management
The form updates the `NewPlanContext` with:
- Customer information
- Payment amounts
- Schedule details
- Notes content

### Step 2: Payment Method Selection
The `PaymentMethodChoice` component offers two paths:

1. **Collect Payment Now**
   - Initializes Stripe Elements
   - Prepares payment intent
   - Transitions to StripePaymentForm

2. **Send Payment Link**
   - Generates payment link
   - Prepares email
   - Transitions to EmailConfirmation

### Step 3a: Immediate Payment (StripePaymentForm)
When collecting payment immediately:
1. Loads Stripe Elements
2. Configures payment form with:
   - Payment amount
   - Currency (USD)
   - Application fee
   - Custom styling

### Step 3b: Payment Link (EmailConfirmation)
When sending payment link:
1. Generates secure payment URL
2. Sends email to customer
3. Shows confirmation screen

### Side Panel: Payment Schedule
The `PaymentSchedule` component:
- Shows real-time payment breakdown
- Updates automatically with form changes
- Displays payment dates and amounts

## Step-by-Step Flow

### 1. Initial Plan Creation
#### Plan Details Form
- User fills out the plan details in `PlanDetailsForm.tsx`
- Form collects:
  - Customer information
  - Total amount
  - Number of payments
  - Payment interval
  - Downpayment amount
- **Important**: Form accepts raw dollar and cents input without formatting

### 2. Backend Processing
#### Create Downpayment Intent
1. Form submission triggers `/api/create-downpayment-intent-and-pending-records`
2. API route:
   - Starts a database transaction
   - Generates UUIDs for:
     - Pending customer
     - Pending payment plan
     - Pending transaction
     - Idempotency key
   - Retrieves Stripe Connect account ID
   - Checks for existing customer
   - Converts amounts to cents
   - Validates transaction types

#### Create Pending Records
The `create_pending_payment_records` function creates:
1. Pending customer record
   - Customer name
   - Email
   - User ID
   - Stripe customer ID

2. Pending payment plan
   - Total amount
   - Number of payments
   - Payment interval
   - Downpayment amount
   - Status
   - Notes

3. Pending transactions
   - Downpayment transaction
   - Future installment transactions
   - Due dates
   - Transaction types

### 3. Payment Collection
#### Payment Method Choice
User chooses between two options in `PaymentMethodChoice.tsx`:
1. **Collect Payment Now**
   - Redirects to `StripePaymentForm`
   - Processes immediate payment
   
2. **Send Payment Link**
   - Triggers `/api/send-payment-link`
   - Sends email to customer
   - Customer completes payment on `/pay` page

### 4. Payment Confirmation
When first payment is processed:

1. Stripe sends success notification
2. Triggers `/api/handle-payment-confirmation`
3. Process includes:
   - Starts database transaction
   - Fetches payment intent
   - Updates transaction status to 'completed'
   - Updates payment plan status to 'ready_to_migrate'
   - Creates email log
   - Triggers migration process

### 5. Data Migration
The `migrate_pending_payment_plan` function:
1. Migrates customer data
   - Creates permanent customer record
   - Links to Stripe customer

2. Migrates payment plan
   - Creates permanent payment plan record
   - Sets status to 'active'
   - Stores card details

3. Migrates transactions
   - Creates permanent transaction records
   - Sets downpayment as 'completed'
   - Sets future payments as 'pending'

4. Cleanup
   - Removes pending records
   - Verifies successful migration

### 6. Data Migration Process
The migration process is handled by the `migrate_pending_payment_plan` function, which performs a secure, atomic migration of pending records to active records:

#### Customer Migration
1. Creates a new permanent customer record with:
   - Generated UUID
   - Customer name and email
   - User ID association
   - Stripe customer ID
   - Creation timestamps

#### Payment Plan Migration
1. Creates a new permanent payment plan with:
   - Generated UUID
   - Associated customer ID
   - Payment details (amounts, schedule)
   - Card information
   - Status set to 'active'
   - Creation timestamps

#### Transaction Migration
1. Migrates all transactions with:
   - Generated UUIDs
   - Associated payment plan ID
   - Original amounts and due dates
   - Status updates:
     - Downpayment marked as 'completed'
     - Future payments marked as 'pending'
   - Stripe payment intent ID for downpayment
   - Payment timestamps and next attempt dates

#### Verification and Cleanup
1. Verifies successful migration:
   - Checks customer record exists
   - Validates payment plan details
   - Confirms transaction count
   
2. Cleanup process:
   - Removes pending transactions
   - Removes pending payment plan
   - Removes pending customer if no other plans reference it

#### Error Handling
- Transaction-based process ensures atomic operations
- Detailed error logging for debugging
- Automatic rollback on failure
- Exception handling with specific error messages

### 7. Post-Migration Actions

#### Email Notifications
1. Sends confirmation email to customer
2. Includes:
   - Payment plan details
   - Payment schedule
   - Next payment date
   - Account access information

#### Record Updates
1. Updates activity logs
2. Creates email log entry
3. Updates payment processing status

#### Payment Schedule Initialization
1. Sets up automatic payment processing
2. Configures retry attempts for failed payments
3. Establishes payment monitoring

## Security Considerations

### Data Protection
1. All database functions use SECURITY DEFINER
2. RLS policies enforce user-level isolation
3. Sensitive data encrypted at rest

### Payment Security
1. Stripe integration for PCI compliance
2. Tokenized card information
3. Secure payment intent creation

### Access Control
1. User authentication required
2. Role-based permissions
3. API endpoint protection

## Error Handling

### Common Error Scenarios
1. Invalid payment details
2. Failed card validation
3. Duplicate payment plans
4. Migration failures

### Recovery Procedures
1. Automatic retry mechanisms
2. Manual intervention points
3. Data consistency checks

## Monitoring and Logging

### Transaction Monitoring
1. Payment status tracking
2. Failed payment alerts
3. Schedule deviation detection

### System Logging
1. Activity audit trail
2. Error logging
3. Performance metrics

## Performance Considerations

### Database Optimization
1. Indexed queries
2. Efficient migrations
3. Connection pooling

### API Performance
1. Rate limiting
2. Caching strategies
3. Async operations

## Backend Integration

### API Endpoints
1. `/api/create-downpayment-intent-and-pending-records`
   - Creates pending records
   - Generates Stripe payment intent
   - Returns necessary IDs and secrets

2. `/api/send-payment-link`
   - Generates payment link
   - Sends customer email
   - Updates plan status

### Database Functions
1. `create_pending_payment_records`
   - Creates temporary records
   - Manages payment schedule
   - Handles customer data

2. `handle_payment_confirmation`
   - Processes successful payments
   - Updates transaction status
   - Triggers migration

3. `migrate_pending_payment_plan`
   - Converts temporary to permanent records
   - Updates payment status
   - Manages cleanup

## Error Handling & Validation

### Form-Level Validation
- Required field checks
- Format validation
- Amount validation
- Payment schedule validation

### API-Level Validation
- Transaction validation
- Customer existence check
- Payment amount verification
- Idempotency checks

### Database-Level Validation
- Transaction atomicity
- Data integrity checks
- Status transitions
- Cleanup verification

## State Management

The payment plan creation process is managed through the `NewPlanContext` (`NewPlanContext.tsx`), which provides:

### Core State
- Plan details including:
  - Customer information (name, email)
  - Payment amounts (total, downpayment)
  - Payment schedule (number of payments, interval)
  - Notes
  - Payment method choice

### Key Functions
- `calculatePaymentSchedule`: Automatically calculates payment schedule based on:
  - Total amount
  - Number of payments
  - Payment interval (weekly/monthly)
  - Downpayment amount
- `createPaymentIntent`: Handles the creation of Stripe payment intents
- `setPaymentMethod`: Manages payment collection method choice

### Payment Schedule Calculation
The context handles complex payment schedule logic:
1. Validates downpayment amount against total
2. Calculates regular payment amounts
3. Adjusts final payment to account for rounding
4. Generates due dates based on payment interval

### Error Handling
- Manages loading states
- Handles API errors
- Validates payment schedule creation
- Ensures Stripe integration readiness

## Testing
- Test plan creation with various payment schedules
- Verify payment processing
- Check email notifications
- Validate data migration
- Test error scenarios

## Related Components
- Database Functions:
  - `create_pending_payment_records`
  - `handle_payment_confirmation`
  - `migrate_pending_payment_plan`
  - `cleanup_pending_payment_records`
- API Routes:
  - `/api/create-downpayment-intent-and-pending-records`
  - `/api/send-payment-link`
  - `/api/handle-payment-confirmation`
- Frontend Components:
  - `NewPlanWizard.tsx`
  - `PlanDetailsForm.tsx`
  - `PaymentMethodChoice.tsx`
  - `StripePaymentForm`
