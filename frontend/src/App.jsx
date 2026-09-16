import { BrowserRouter, Route, Routes } from 'react-router-dom'
import BookingPage from './pages/BookingPage'
import MainPage from './pages/MainPage'
import OwnerSchedulePage from './pages/OwnerSchedulePage'
import OwnerTypesPage from './pages/OwnerTypesPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/booking" element={<BookingPage />} />
        <Route path="/owner/types" element={<OwnerTypesPage />} />
        <Route path="/owner/schedule" element={<OwnerSchedulePage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App