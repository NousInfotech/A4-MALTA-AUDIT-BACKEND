// server.js
require("dotenv").config()
const express = require("express")
const connectDB = require("./config/db")
const cors = require("cors")
const http = require("http")
const { Server } = require("socket.io")
const engagementRoutes = require("./routes/engagements")
const documentRequestRoutes = require("./routes/documentRequests")
const procedureRoutes = require("./routes/procedures")
const { requireAuth, requireRole } = require("./middlewares/auth")
const { supabase } = require("./config/supabase")

const checklistRoutes = require("./routes/checklist")
const globalRoutes = require("./routes/global-library")
const app = express()

app.use(
  cors({
    origin: "http://localhost:8080",
  }),
)

const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: "*" },
})

// Make io available to your controllers
app.set("io", io)

// Middleware & DB
app.use(cors())
connectDB()
app.use(express.json())

// Routes
app.use("/api/checklist", checklistRoutes)
app.use("/api/global-library", globalRoutes)
app.use("/api/engagements", engagementRoutes)
app.use("/api/document-requests", documentRequestRoutes)
app.use("/api/procedures", procedureRoutes)

app.post("/api/clients", requireAuth, requireRole("employee"), async (req, res) => {
  try {
    const { email, password, name, companyName, companyNumber, industry, summary } = req.body
    //console.log(req.body)
    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required" })
    }

    // 1. Create auth user with admin privileges
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        role: "client",
        name: name,
      },
    })

    if (authError) {
      throw authError
    }

    // 2. Create user record in your users table with client-specific fields
    const { data: userRecord, error: dbError } = await supabase
      .from("profiles")
      .insert({
        user_id: authUser.user.id,
        name: name,
        role: "client",
        status: "pending", // Default status as per your interface
        company_name: companyName,
        company_number: companyNumber,
        industry: industry,
        company_summary: summary,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dbError) {
      // Clean up auth user if DB insert fails
      await supabase.auth.admin.deleteUser(authUser.user.id)
      throw dbError
    }

    // 3. Return the created client
    res.status(201).json({
      message: "Client created successfully (pending approval)",
      client: userRecord,
    })
  } catch (error) {
    console.error("Error creating client:", error)
    res.status(500).json({
      error: error.message || "Failed to create client",
    })
  }
})

app.get("/api/client/email/:id", requireAuth, async (req, res) => {
  try {
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(req.params.id)

    if (authError) {
      throw authError
    }

    if (!authUser.user.email) {
      throw new Error("Email not found for this user")
    }

    res.status(200).json({
      message: "Client email retrieved successfully",
      clientData: {
        email: authUser.user.email,
      },
    })
  } catch (error) {
    console.error("Error getting client email:", error)
    res.status(500).json({
      error: error.message || "Failed to get client email",
    })
  }
})

// Health check
app.get("/", (req, res) => res.send("API is running"))

// Socket.IO rooms
io.on("connection", (socket) => {
  socket.on("joinEngagement", (id) => socket.join(`engagement_${id}`))
  socket.on("leaveEngagement", (id) => socket.leave(`engagement_${id}`))
})

// **This** starts *both* Express and Socket.IO
const PORT = process.env.PORT || 8000
server.listen(PORT, () => {
  console.log(`🚀 Server + Socket.IO listening on http://localhost:${PORT}`)
})
