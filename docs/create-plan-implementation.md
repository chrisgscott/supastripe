# Create Plan Implementation

This document outlines the detailed plan for implementing the `/create-plan` process as a single page. The plan includes the layout, state management, API interactions, and error handling strategies.

## Page Layout and Structure

- **Left Column:**
  - **Plan Details Form:** Collects customer name, email, total amount, number of payments, payment interval, and downpayment amount.
  - **Payment Details Form:** Displays the Stripe payment element for entering payment details.

- **Right Column:**
  - **Payment Schedule Display:** Updates in real-time as the user fills out the plan details form, showing the calculated payment schedule.

## State Management

- **React Context:** Use a context to manage the state of the plan details, payment schedule, and Stripe client secret. This allows all components to access and update the state as needed.

## Plan Details Form

- **Fields:**
  - Customer Name
  - Customer Email
  - Total Amount
  - Number of Payments
  - Payment Interval (Weekly/Monthly)
  - Downpayment Amount

- **Validation:**
  - Validate each field on change and display errors if any.
  - Ensure the downpayment is less than the total amount.

- **State Updates:**
  - Update the plan details in the context on each change.
  - Recalculate the payment schedule whenever relevant fields change.

## Payment Schedule Calculation

- **Function:** `calculatePaymentSchedule`
  - Convert amounts to cents for calculations.
  - Calculate the downpayment and regular payment amounts.
  - Generate a schedule of payments based on the interval and number of payments.
  - Update the payment schedule in the context.

## Payment Details Form

- **Stripe Elements:**
  - Load Stripe Elements using the client secret from the context.
  - Display a payment form for the user to enter their payment details.

- **Submit Payment:**
  - On form submission, confirm the payment using Stripe's `confirmPayment` method.
  - Handle any errors and display them to the user.

## API Interaction: Create Payment Plan and Intent

- **Endpoint:** `/api/create-payment-plan-and-customer`
- **Steps:**
  1. **Start Database Transaction:** Begin a transaction to ensure atomicity.
  2. **Fetch User and Stripe Account:** Retrieve the authenticated user and their connected Stripe account.
  3. **Check/Create Stripe Customer:** Check if the customer exists in Stripe; create if not.
  4. **Create Payment Intent:**
     - Amount: Downpayment amount in cents.
     - Currency: USD.
     - Customer: Stripe customer ID.
     - Automatic Payment Methods: Enabled.
     - Setup Future Usage: `off_session`.
     - Application Fee: Calculate based on a percentage of the downpayment.
     - Transfer Data: Set the destination to the user's connected Stripe account.
  5. **Insert Customer in Database:** Add the customer to the `customers` table.
  6. **Insert Payment Plan in Database:** Add the plan to the `payment_plans` table.
  7. **Insert Transactions in Database:** Add each payment in the schedule to the `transactions` table.
  8. **Commit Transaction:** If all steps succeed, commit the transaction.
  9. **Error Handling:** If any step fails, rollback the transaction and handle the error.

## Error Handling and Rollback

- **Transaction Rollback:** Ensure that any failure in the process results in a rollback of the database transaction to maintain data integrity.
- **Stripe Cleanup:** If a Stripe customer or payment intent was created but the process fails, delete these resources to avoid orphaned records.

## Confirmation and Email Notification

- **Confirmation Step:** Display a confirmation message once the payment is successful.
- **Send Email:** Trigger an email to the customer with the payment plan details using the `/api/send-payment-plan-email` endpoint.

## Testing and Validation

- **Test Cases:**
  - Successful plan creation and payment.
  - Validation errors in the form.
  - Stripe payment errors.
  - Database transaction rollback on failure.
  - Email notification delivery.

## Deployment and Monitoring

- **Deployment:** Deploy the updated page and API endpoints to the production environment.
- **Monitoring:** Set up logging and monitoring to track errors and performance issues.

## Additional Notes and Reminders

- **Application Fees:** Ensure that the application fee is calculated and applied correctly based on the downpayment amount. This fee is a percentage of the downpayment and should be set in the environment variables.
- **Stripe Connect:** Payments should be processed using Stripe Connect, with the `transfer_data` field set to direct funds to the user's connected Stripe account.
- **Payment Method Storage:** Ensure that the payment method is saved for future off-session use by setting `setup_future_usage` to `off_session` in the payment intent.
- **Idempotency:** Use idempotency keys to prevent duplicate charges in case of network issues or retries.
- **Environment Variables:** Verify that all necessary environment variables (e.g., Stripe keys, Supabase keys) are set and accessible in the deployment environment.
- **Security:** Ensure that all sensitive data is handled securely, and that API endpoints are protected against unauthorized access.
- **Collect Payment Details Before Creating an Intent** We're following this approach (https://docs.stripe.com/payments/accept-a-payment-deferred) so we can load the payment details form as early as possible in the order of operations and so we can have as few API calls as possible.

This document serves as a roadmap and checklist to ensure a comprehensive and reliable implementation of the `/create-plan` process.
