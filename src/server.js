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
const reviewRoutes = require("./routes/review");
const classificationReviewRoutes = require("./routes/classificationReview");
const classificationEvidenceRoutes = require("./routes/classificationEvidence");
const classificationSectionsRoutes = require("./routes/classificationSections");
const completionProceduresRoutes = require("./routes/completionProcedures");
const analyticalReviewRoutes = require("./routes/analyticalReview");
const workbookRoutes = require("./routes/workbook");
const companyRoutes = require("./routes/companyRoutes");
const personRoutes = require("./routes/personRoutes");
const brandingRoutes = require("./routes/brandingRoutes");
const tourRoutes = require("./routes/tourRoutes");
const adjustmentRoutes = require("./routes/adjustment.routes");
const reclassificationRoutes = require("./routes/reclassification.routes");
const workingPaperRoutes = require("./routes/workingPaperRoutes");
const organizationRoutes = require("./routes/organizations");
const notificationRoutes = require("./routes/notifications");
const documentRequestTemplateRoutes = require("./routes/documentRequestTemplateRoutes");
const wordPluginRoutes = require("./routes/wordPlugin");
const app = express();

app.use(
  cors({
    origin: [
      "https://a4-malta-audit-portal.vercel.app",
      "https://a4-malta-audit-port-git-d8e11d-nous-infotechs-projects-9f0f6ce5.vercel.app",
      "http://localhost:8080",
      "https://portal.a4.com.mt",
    ],
    credentials: true // optional: if you need to allow cookies/auth headers
  })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.set("io", io);

connectDB();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/api/planning-procedures", require("./routes/planningProcedures"));
// Add this to your existing routes
app.use("/api/admin/prompts", require("./routes/prompts"));
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
app.use("/api/review", reviewRoutes);
app.use("/api/classification-reviews", classificationReviewRoutes);
app.use("/api/classification-evidence", classificationEvidenceRoutes);
app.use("/api/classification-sections", classificationSectionsRoutes);
app.use("/api/completion-procedures", completionProceduresRoutes);
app.use("/api/analytical-review", analyticalReviewRoutes);
app.use("/api/workbooks", workbookRoutes);
app.use("/api/client", companyRoutes);
app.use("/api/client", personRoutes);
app.use("/api/branding", brandingRoutes);
app.use("/api/tours", tourRoutes);
app.use("/api/adjustments", adjustmentRoutes);
app.use("/api/reclassifications", reclassificationRoutes);
app.use("/api/working-papers", workingPaperRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/document-request-templates", documentRequestTemplateRoutes);
app.use("/api/word-plugin", wordPluginRoutes);

app.get("/", (req, res) => res.send("API is running"));

io.on("connection", (socket) => {
  socket.on("joinEngagement", (id) => socket.join(`engagement_${id}`));
  socket.on("leaveEngagement", (id) => socket.leave(`engagement_${id}`));
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`🚀 Server + Socket.IO listening on http://localhost:${PORT}`);
});
