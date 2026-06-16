import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ChatProvider } from "@/context/ChatContext"
import LandingPage from "./pages/LandingPage"
import ChatPage from "./pages/ChatPage"

function App() {
  return (
    <TooltipProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/chat"
            element={
              <ChatProvider>
                <ChatPage />
              </ChatProvider>
            }
          />
        </Routes>
      </Router>
    </TooltipProvider>
  )
}

export default App
