# Event System Migration Plan

## Overview
Migrating from the current trigger-based activity logging system to a more maintainable event-driven architecture.

## Goals
- Simplify activity logging
- Reduce maintenance overhead
- Enable real-time updates
- Maintain backward compatibility
- Ensure zero downtime during migration

## Migration Phases

### Phase 1: Infrastructure Setup
- [x] Create new `events` table
- [x] Create `publish_activity` function
- [x] Set up RLS policies
- [x] Create new `EventFeed` component
- [ ] Add database indices for performance
- [ ] Create helper functions for common event publishing patterns

### Phase 2: Parallel Write Mode
- [ ] Modify `publish_activity` to write to both systems
- [ ] Update existing triggers to use `publish_activity`:
  - [ ] `log_payment_plan_activity`
  - [ ] `log_email_activity`
  - [ ] Other activity triggers
- [ ] Add event publishing to API routes:
  - [ ] `/api/handle-payment-confirmation`
  - [ ] `/api/create-downpayment-intent-and-pending-records`
  - [ ] Other relevant routes

### Phase 3: UI Migration
- [ ] Add new `EventFeed` component alongside existing `ActivityLogsTable`
- [ ] Test both components in parallel
- [ ] Migrate dashboard to use `EventFeed`
- [ ] Migrate plan details page to use `EventFeed`
- [ ] Add any missing event types or formatters

### Phase 4: Data Migration
- [ ] Create migration script to populate `events` from `activity_logs`
- [ ] Run migration in staging
- [ ] Verify data consistency
- [ ] Run migration in production

### Phase 5: Cleanup
- [ ] Remove old trigger functions
- [ ] Remove `activity_logs` table
- [ ] Remove old activity components
- [ ] Update documentation

## Testing Strategy
1. Unit Tests:
   - Event publishing function
   - Event formatting
   - Component rendering

2. Integration Tests:
   - Real-time updates
   - Data consistency
   - Performance

3. Migration Tests:
   - Data migration accuracy
   - Zero data loss verification

## Rollback Plan
1. Keep old system running in parallel
2. Maintain database triggers
3. Keep activity_logs table until verified
4. Quick switch back to old UI if needed

## Performance Considerations
- Index on (user_id, created_at) for quick queries
- Index on (customer_id) for filtered views
- Monitor real-time subscription performance
- Implement pagination for large datasets

## Security Considerations
- Maintain RLS policies
- Audit event access patterns
- Validate event metadata
- Sanitize user inputs

## Timeline
1. Phase 1: 1-2 days
2. Phase 2: 2-3 days
3. Phase 3: 2-3 days
4. Phase 4: 1-2 days
5. Phase 5: 1 day

Total estimated time: 7-11 days

## Success Metrics
- Reduced code complexity
- Faster activity feed updates
- Improved maintainability
- Zero production issues
- Complete data consistency

## Notes
- Keep track of any custom event types added during migration
- Document any performance optimizations needed
- Monitor Supabase quotas for real-time connections
