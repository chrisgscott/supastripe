import { SupabaseClient } from '@supabase/supabase-js'

export type EventType = 
  | 'plan_created'
  | 'plan_updated'
  | 'plan_activated'
  | 'plan_completed'
  | 'plan_cancelled'
  | 'payment_confirmed'
  | 'payment_failed'
  | 'payment_refunded'
  | 'payment_link_sent'
  | 'payment_reminder_sent'
  | 'payment_confirmation_sent'

export type EntityType = 'payment_plan' | 'payment' | 'email'

export interface EventMetadata {
  [key: string]: any
}

export async function publishEvent(
  supabase: SupabaseClient,
  {
    eventType,
    entityType,
    entityId,
    userId,
    metadata = {},
    customerId
  }: {
    eventType: EventType
    entityType: EntityType
    entityId: string
    userId: string
    metadata?: EventMetadata
    customerId?: string
  }
) {
  const { data, error } = await supabase.rpc('publish_activity', {
    p_event_type: eventType,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_user_id: userId,
    p_metadata: metadata,
    p_customer_id: customerId
  })

  if (error) {
    console.error('Failed to publish event:', error)
    throw error
  }

  return data
}

// Helper functions for common events
export const PaymentPlanEvents = {
  created: (supabase: SupabaseClient, {
    planId,
    userId,
    customerId,
    metadata = {}
  }: {
    planId: string
    userId: string
    customerId: string
    metadata?: EventMetadata
  }) => {
    return publishEvent(supabase, {
      eventType: 'plan_created',
      entityType: 'payment_plan',
      entityId: planId,
      userId,
      customerId,
      metadata
    })
  },

  updated: (supabase: SupabaseClient, {
    planId,
    userId,
    customerId,
    metadata = {}
  }: {
    planId: string
    userId: string
    customerId: string
    metadata?: EventMetadata
  }) => {
    return publishEvent(supabase, {
      eventType: 'plan_updated',
      entityType: 'payment_plan',
      entityId: planId,
      userId,
      customerId,
      metadata
    })
  },

  // Add more payment plan event helpers...
}

export const PaymentEvents = {
  confirmed: (supabase: SupabaseClient, {
    paymentId,
    userId,
    customerId,
    amount,
    metadata = {}
  }: {
    paymentId: string
    userId: string
    customerId: string
    amount: number
    metadata?: EventMetadata
  }) => {
    return publishEvent(supabase, {
      eventType: 'payment_confirmed',
      entityType: 'payment',
      entityId: paymentId,
      userId,
      customerId,
      metadata: {
        amount,
        ...metadata
      }
    })
  },

  // Add more payment event helpers...
}

export const EmailEvents = {
  paymentLinkSent: (supabase: SupabaseClient, {
    emailId,
    userId,
    customerId,
    recipient,
    metadata = {}
  }: {
    emailId: string
    userId: string
    customerId: string
    recipient: string
    metadata?: EventMetadata
  }) => {
    return publishEvent(supabase, {
      eventType: 'payment_link_sent',
      entityType: 'email',
      entityId: emailId,
      userId,
      customerId,
      metadata: {
        recipient,
        ...metadata
      }
    })
  },

  // Add more email event helpers...
}
