import Link from 'next/link'

export default function Sidebar() {
  return (
    <aside className="bg-gray-100 w-64 min-h-screen p-4">
      <nav>
        <ul className="space-y-2">
          <li>
            <Link href="/dashboard" className="block hover:bg-gray-200 p-2 rounded">
              Dashboard
            </Link>
          </li>
          <li>
            <Link href="/profile" className="block hover:bg-gray-200 p-2 rounded">
              Profile
            </Link>
          </li>
          {/* Add more menu items as needed */}
        </ul>
      </nav>
    </aside>
  )
}