require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const engagementRoutes = require("./routes/engagements");
const documentRequestRoutes = require("./routes/documentRequests");
const procedureRoutes = require("./routes/procedures");
const { requireAuth, requireRole } = require("./middlewares/auth");
const { supabase } = require("./config/supabase");
const usersRoutes = require("./routes/users");
const checklistRoutes = require("./routes/checklist");
const bodyParser = require("body-parser");
const globalRoutes = require("./routes/global-library");
const saltedgeRoutes = require("./routes/saltedge");
const apideckRoutes = require("./routes/apideck");
const pbcRoutes = require("./routes/pbc");
const kycRoutes = require("./routes/kyc");
const employeeLogRoutes = require("./routes/employeeLogs");
const isqmRoutes = require("./routes/isqm");
const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:8080",
      "https://audit-portal-1-75ac69871dcd.herokuapp.com",
      "https://portal.a4.com.mt",
      "http://portal.a4.com.mt",
      "https://a4-malta-audit-port-git-d8e11d-nous-infotechs-projects-9f0f6ce5.vercel.app/login"
    ],
    credentials: true // optional: if you need to allow cookies/auth headers
  })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.set("io", io);

app.use(cors());
connectDB();
app.use(express.json());
app.use("/api/planning-procedures", require("./routes/planningProcedures"));
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/api/checklist", checklistRoutes);
app.use("/api/global-library", globalRoutes);
app.use("/api/engagements", engagementRoutes);
app.use("/api/document-requests", documentRequestRoutes);
app.use("/api/procedures", procedureRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/saltedge", saltedgeRoutes);
app.use("/api/apideck", apideckRoutes);
app.use("/api/pbc", pbcRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/employee-logs", employeeLogRoutes);
app.use("/api/isqm", isqmRoutes);

app.get("/", (req, res) => res.send("API is running"));

io.on("connection", (socket) => {
  socket.on("joinEngagement", (id) => socket.join(`engagement_${id}`));
  socket.on("leaveEngagement", (id) => socket.leave(`engagement_${id}`));
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`🚀 Server + Socket.IO listening on http://localhost:${PORT}`);
});
