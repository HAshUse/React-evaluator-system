import { useState, useEffect } from 'react'

function App() {
  const [data, setData] = useState(null)
  const [count, setCount] = useState(0)
  const [route, setRoute] = useState('/')

  // API Integration (Criteria 5)
  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(json => setData(json))
  }, [])

  // Routing Simulation (Criteria 4)
  if (route === '/about') {
    return (
      <div>
        <h1>About Page</h1>
        <a href="#/" onClick={(e) => { e.preventDefault(); setRoute('/') }}>Go Home</a>
      </div>
    )
  }

  return (
    <div>
      {/* Component & Text Content (Criteria 1) */}
      <h1>Main Dashboard</h1>
      <p>Welcome to the React Evaluator test app.</p>

      {/* State Updates (Criteria 3) */}
      <button onClick={() => setCount(count + 1)}>
        Clicked {count} times
      </button>

      {/* Props Handling - Intentionally Missing/Failing (Criteria 2) 
          To test AI feedback, we will NOT render any lists/cards here.
      */}

      {/* API Data Rendering */}
      {data && (
        <div>
          <h2>User: {data.name || 'MockedUser'}</h2>
          <p>Message: {data.message || 'api-mock-success'}</p>
        </div>
      )}

      {/* Routing Navigation */}
      <nav>
        <a href="#/about" onClick={(e) => { e.preventDefault(); setRoute('/about') }}>
          About Us
        </a>
      </nav>
    </div>
  )
}

export default App
