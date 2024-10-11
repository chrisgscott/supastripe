import { createClient } from '@/utils/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarIcon, UserIcon, ActivityIcon } from 'lucide-react'

export default async function Dashboard() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Fetch some mock data (replace with real data fetching logic later)
  const totalUsers = 1234
  const activeUsers = 789
  const recentActivity = [
    { id: 1, action: "User signup", timestamp: "2023-06-01T10:00:00Z" },
    { id: 2, action: "Profile update", timestamp: "2023-06-02T15:30:00Z" },
    { id: 3, action: "New post created", timestamp: "2023-06-03T09:45:00Z" },
  ]

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Welcome, {user?.email}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <ActivityIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Date</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Date().toLocaleDateString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {recentActivity.map((activity) => (
              <li key={activity.id} className="flex justify-between items-center">
                <span>{activity.action}</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(activity.timestamp).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}