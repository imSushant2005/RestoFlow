import { Routes, Route } from 'react-router-dom'
import { KitchenBoard } from './pages/KitchenBoard'

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <Routes>
        <Route path="/" element={<KitchenBoard />} />
      </Routes>
    </div>
  )
}

export default App
