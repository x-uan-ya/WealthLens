import "dotenv/config";
import express from "express";
import cors from "cors";
import { generateRMBrief } from "./services/openaiService.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "WealthLens API",
  });
});

app.post("/api/ai/brief", async (req, res) => {
  try {
    const { input } = req.body;

    if (!input) {
      return res.status(400).json({
        error: "Input is required.",
      });
    }

    const brief = await generateRMBrief(input);

    res.json({ brief });
  } catch (error) {
    console.error("OpenAI request failed:", error);

    res.status(500).json({
      error: "Unable to generate RM brief.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`WealthLens API running on http://localhost:${PORT}`);
});