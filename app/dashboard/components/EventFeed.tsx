import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { CalendarIcon, CreditCardIcon, DocumentIcon, EnvelopeIcon } from '@heroicons/react/24/outline'

// Event type definitions
type Event = {
  id: string
  created_at: string
  event_type: string
  entity_type: string
  entity_id: string
  metadata: Record<string, any>
  customer_id?: string
}

// Icon mapping - similar to before, but more extensible
const EVENT_ICONS: Record<string, React.ComponentType<any>> = {
  'payment_confirmed': CreditCardIcon,
  'payment_link_sent': EnvelopeIcon,
  'plan_created': DocumentIcon,
  'plan_updated': DocumentIcon,
  // Add more icons as needed, with a default
  'default': CalendarIcon,
}

// Message formatting - similar to before, but more data-driven
const formatEventMessage = (event: Event): string => {
  const messages: Record<string, (event: Event) => string> = {
    'payment_confirmed': (e) => `Payment of $${e.metadata.amount} confirmed`,
    'payment_link_sent': (e) => `Payment link sent to ${e.metadata.recipient}`,
    'plan_created': (e) => `Payment plan created for ${e.metadata.customer_name}`,
    'plan_updated': (e) => `Payment plan updated: ${e.metadata.change_description}`,
    // Add more message formatters as needed
    'default': (e) => `${e.event_type.replace(/_/g, ' ')}`,
  }

  const formatter = messages[event.event_type] || messages.default
  return formatter(event)
}

type EventFeedProps = {
  user: User
  customerId?: string // Optional - to filter for specific customer's events
  limit?: number
}

export function EventFeed({ user, customerId, limit = 10 }: EventFeedProps) {
  const [events, setEvents] = useState<Event[]>([])
  const supabase = createClient()

  useEffect(() => {
    // Initial fetch
    const fetchEvents = async () => {
      let query = supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit)

      // Add customer filter if specified
      if (customerId) {
        query = query.eq('customer_id', customerId)
      }

      const { data, error } = await query
      if (!error && data) {
        setEvents(data)
      }
    }

    fetchEvents()

    // Set up realtime subscription
    const subscription = supabase
      .channel('events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: customerId 
            ? `user_id=eq.${user.id}&customer_id=eq.${customerId}`
            : `user_id=eq.${user.id}`
        },
        (payload) => {
          setEvents(current => {
            const newEvent = payload.new as Event
            return [newEvent, ...current].slice(0, limit)
          })
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user.id, customerId, limit])

  return (
    <div className="flow-root">
      <ul role="list" className="-mb-8">
        {events.map((event, eventIdx) => {
          const Icon = EVENT_ICONS[event.event_type] || EVENT_ICONS.default
          
          return (
            <li key={event.id}>
              <div className="relative pb-8">
                {eventIdx !== events.length - 1 ? (
                  <span
                    className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                ) : null}
                <div className="relative flex space-x-3">
                  <div>
                    <span className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center ring-8 ring-white">
                      <Icon className="h-5 w-5 text-gray-500" aria-hidden="true" />
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div>
                      <p className="text-sm text-gray-500">
                        {formatEventMessage(event)}
                      </p>
                    </div>
                    <div className="whitespace-nowrap text-right text-sm text-gray-500">
                      <time dateTime={event.created_at}>
                        {new Date(event.created_at).toLocaleDateString()}
                      </time>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
