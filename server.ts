import express from "express";
import { createServer as createViteServer } from "vite";
import Stripe from "stripe";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      console.warn("STRIPE_SECRET_KEY is missing. Stripe features will not work.");
      // Return a dummy object or throw, but throwing might crash the request.
      // Better to throw here so the specific request fails, not the server startup.
      throw new Error("STRIPE_SECRET_KEY is missing");
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const stripe = getStripe();
      const { userId, userEmail } = req.body;

      if (!userId || !userEmail) {
        return res.status(400).json({ error: "Missing userId or userEmail" });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Vérification de compte Vendeur TradeHub",
                description: "Frais de vérification (5$) + Premier mois d'abonnement (3$)",
              },
              unit_amount: 800, // $8.00 ($5 setup + $3 first month)
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.APP_URL || 'http://localhost:3000'}/#/verification?verification=success`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/#/verification?verification=cancel`,
        customer_email: userEmail,
        metadata: {
          userId: userId,
          type: 'verification'
        }
      });

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error("Stripe error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Flutterwave Mobile Money Integration (RDC)
  app.post("/api/initiate-mobile-money", async (req, res) => {
    const { userId, userEmail, phoneNumber, provider, amount } = req.body;
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;

    if (!secretKey) {
      return res.status(500).json({ error: "Flutterwave not configured" });
    }

    try {
      // Mapping providers for Flutterwave RDC
      // Providers: 'ORANGE', 'AIRTEL', 'VODACOM' (M-Pesa)
      const tx_ref = `tradehub-verif-${userId}-${Date.now()}`;
      
      const response = await axios.post(
        "https://api.flutterwave.com/v3/charges?type=mobile_money_franco",
        {
          amount: amount || 8, // $8 total
          currency: "USD",
          email: userEmail,
          phone_number: phoneNumber,
          tx_ref: tx_ref,
          network: provider.toUpperCase(), // ORANGE, AIRTEL, VODACOM
          fullname: userEmail.split('@')[0],
          redirect_url: `${process.env.APP_URL || 'http://localhost:3000'}/#/verification?verification=success`
        },
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      res.json(response.data);
    } catch (error: any) {
      console.error("Flutterwave Error:", error?.response?.data || error.message);
      res.status(500).json({ error: error?.response?.data?.message || "Erreur Mobile Money" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
