import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini safely
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': "aistudio-build",
        },
      },
    });
    console.log("Gemini API initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize Gemini Client:", error);
  }
} else {
  console.warn("GEMINI_API_KEY is not defined. Using local offline response models.");
}

// ----------------------------------------------------
// SERVER-SIDE API ENDPOINTS
// ----------------------------------------------------

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
});

// secure AI chatbot proxy endpoint
app.post("/api/chat", async (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    res.status(400).json({ error: "Prompt is required." });
    return;
  }

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: `You are JS Horticulture, an expert organic agricultural farming chatbot and virtual consultant for the luxury "JS Horticulture" Dragon Fruit Farmhouse.
          You assist farmers, home growers, and premium customers from around the world.
          Be supportive, detailed, professional, and farm-focused. Include highly practical steps for pitaya (dragon fruit) growing, watering, fertilizers (favor organic nitrogen/manure in active grows and potash/bone-meal in blooming), pruning structures, soils (sandy-loam mixes), and pest controls.
          Avoid uninvited technical jargon of databases or AI mechanics. Limit your answer to 3 fluid paragraphs or short bullet structures.`,
        }
      });
      res.json({ reply: response.text });
      return;
    } catch (e: any) {
      console.error("Error communicating with Gemini on server:", e);
      res.status(500).json({ error: "Gemini server-side invocation failed: " + e.message });
      return;
    }
  }

  // Fallback to offline logic if key is omitted
  res.status(200).json({ 
    reply: "Hello from JS Horticulture offline companion! (No API key loaded). Dragon fruit grows best in high sandy-loam drainage with precise water delivery of 1.5 gallons per vine 3x weekly in summers. Ensure they get full solar light and potassium-rich compost in blooming phases." 
  });
});

// AI Product Recommendations proxy
app.post("/api/recommendations", async (req, res) => {
  const { userPreferences } = req.body;
  
  // Intelligent auto responses with rich details
  if (ai) {
    try {
      const gPrompt = `Recommend 2 dragon fruit farm products from: Fresh Fruits, Organic Juice, Dragon Fruit Jam, Plants & Saplings, Farm Compost based on: ${JSON.stringify(userPreferences)}. Just return a short JSON array consisting of recomended product category names.`;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: gPrompt,
      });
      res.json({ reply: response.text });
      return;
    } catch {
      // safe fallback
    }
  }
  
  // Deterministic smart recommendations based on preferences
  const recommended = ["Fresh Fruits", "Organic Juice"];
  if (userPreferences?.includes("growing") || userPreferences?.includes("sapling")) {
    recommended[0] = "Plants & Saplings";
    recommended[1] = "Farm Compost";
  } else if (userPreferences?.includes("gift") || userPreferences?.includes("jam")) {
    recommended[0] = "Dragon Fruit Jam";
    recommended[1] = "Organic Juice";
  }
  res.json({ recommended });
});

// ----------------------------------------------------
// VITE AND STATIC FILE SERVING MIDDLEWARE
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server active at http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

startServer().catch((err) => {
  console.error("Critical error starting our Express server:", err);
});
