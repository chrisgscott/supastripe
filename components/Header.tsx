import AuthButton from './header-auth'

export default function Header() {
  return (
    <header className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">Your App Name</h1>
        <AuthButton />
      </div>
    </header>
  )
}